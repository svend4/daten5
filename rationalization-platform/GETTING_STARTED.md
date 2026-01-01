# Getting Started with Rationalization Platform

## Quick Start (5 minutes)

### Prerequisites

Ensure you have the following installed:
- Docker Desktop (v20.10+)
- Docker Compose (v2.0+)
- Node.js (v18+) - optional, for local development
- Python (v3.11+) - optional, for local development

### Step 1: Clone and Setup

```bash
# Clone the repository
cd rationalization-platform

# Copy environment variables
cp .env.example .env

# Edit .env and add your API keys (optional for basic testing)
# Required for full functionality:
# - OPENAI_API_KEY (for AI classification)
# - GITHUB_TOKEN (for crawler)
```

### Step 2: Start Infrastructure

```bash
# Start all services with Docker Compose
docker-compose up -d

# Wait for services to be healthy (2-3 minutes)
docker-compose ps

# Check logs
docker-compose logs -f
```

### Step 3: Initialize Database

```bash
# Run database migrations
docker-compose exec catalog-api npm run migrate

# (Optional) Seed with sample data
docker-compose exec catalog-api npm run seed
```

### Step 4: Access Services

Once all services are running, access:

| Service | URL | Description |
|---------|-----|-------------|
| **API Gateway** | http://localhost:8000 | Main API entry point |
| **Catalog API** | http://localhost:3000/api | REST API |
| **GraphQL Playground** | http://localhost:3000/graphql | GraphQL interface |
| **AI Classifier** | http://localhost:8001 | AI classification service |
| **Neo4j Browser** | http://localhost:7474 | Graph database (neo4j/changeme123) |
| **Grafana** | http://localhost:3001 | Monitoring dashboards (admin/admin) |
| **Prometheus** | http://localhost:9090 | Metrics |

## Usage Examples

### 1. Create an Application via REST API

```bash
curl -X POST http://localhost:8000/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "name": "React",
    "slug": "react",
    "description": "A JavaScript library for building user interfaces",
    "type": "library",
    "source": "github",
    "sourceUrl": "https://github.com/facebook/react",
    "homepageUrl": "https://react.dev",
    "license": "MIT",
    "tags": ["javascript", "ui", "frontend"]
  }'
```

### 2. Search Applications

```bash
# Text search
curl "http://localhost:8000/api/search?q=react&limit=10"

# Filter by type
curl "http://localhost:8000/api/applications?type=library&limit=10"

# Search suggestions (autocomplete)
curl "http://localhost:8000/api/search/suggestions?q=rea"
```

### 3. Use GraphQL

```graphql
# Query applications
query {
  applications(first: 10, filter: { type: [LIBRARY] }) {
    edges {
      node {
        id
        name
        description
        stars
        capabilities {
          name
          category
        }
      }
    }
    pageInfo {
      totalCount
      hasNextPage
    }
  }
}

# Create application
mutation {
  createApplication(input: {
    name: "Next.js"
    slug: "nextjs"
    description: "The React Framework"
    type: FRAMEWORK
    source: GITHUB
    sourceUrl: "https://github.com/vercel/next.js"
  }) {
    id
    name
    slug
  }
}
```

### 4. AI Classification

```bash
# Classify an application
curl -X POST http://localhost:8001/classify \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Stripe",
    "description": "Payment infrastructure for the internet",
    "tags": ["payment", "api", "saas"]
  }'

# Response:
{
  "type": "service",
  "capabilities": ["payment", "api", "subscription"],
  "confidence": 0.95,
  "suggested_tags": ["payment", "api", "saas", "fintech"]
}
```

### 5. Semantic Search

```bash
# Semantic search using AI
curl -X POST http://localhost:8001/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "I need a library for building reactive user interfaces",
    "limit": 5,
    "threshold": 0.7
  }'
```

### 6. Run GitHub Crawler

```bash
# Crawl popular JavaScript repositories
docker-compose exec github-crawler python main.py

# Or run specific language
docker-compose exec github-crawler python -c "
from main import GitHubCrawler
crawler = GitHubCrawler()
crawler.crawl_popular_repositories(language='Python', limit=100)
crawler.close()
"
```

### 7. Query Neo4j Graph

Access Neo4j Browser at http://localhost:7474 and run:

```cypher
// Find all applications built with JavaScript
MATCH (app:Application)-[:BUILT_WITH]->(tech:Technology {name: 'JavaScript'})
RETURN app.name, app.stars
ORDER BY app.stars DESC
LIMIT 10;

// Find alternatives to React
MATCH (app:Application {name: 'React'})-[:SIMILAR_TO]->(alt:Application)
RETURN alt.name, alt.description
ORDER BY alt.stars DESC;

// Find shortest path to integrate React with PostgreSQL
MATCH path = shortestPath(
  (a:Application {name: 'React'})-[*]-(b:Application {name: 'PostgreSQL'})
)
RETURN path;
```

## Development Workflow

### Local Development (without Docker)

#### 1. Start Databases

```bash
# Start only infrastructure services
docker-compose up -d postgres neo4j redis elasticsearch rabbitmq

# Verify they're running
docker-compose ps
```

#### 2. Run Catalog API Locally

```bash
cd backend/catalog-api

# Install dependencies
npm install

# Create .env
cp .env.example .env

# Edit database connection strings to point to localhost
# POSTGRES_HOST=localhost
# NEO4J_URI=bolt://localhost:7687
# REDIS_HOST=localhost

# Run migrations
npm run migrate

# Start development server
npm run dev

# Server will start at http://localhost:3000
```

#### 3. Run AI Classifier Locally

```bash
cd backend/ai-classifier

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env
cp .env.example .env

# Start development server
uvicorn main:app --reload --port 8001

# Server will start at http://localhost:8001
```

#### 4. Run GitHub Crawler

```bash
cd backend/github-crawler

# Activate virtual environment (if not already)
source venv/bin/activate

# Set environment variables
export GITHUB_TOKEN=your_token_here
export POSTGRES_HOST=localhost

# Run crawler
python main.py
```

### Testing

```bash
# Test Catalog API
cd backend/catalog-api
npm test

# Test with coverage
npm run test:coverage

# Test AI Classifier
cd backend/ai-classifier
pytest
pytest --cov=.
```

### Debugging

#### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f catalog-api

# Last 100 lines
docker-compose logs --tail=100 catalog-api
```

#### Execute Commands in Containers

```bash
# PostgreSQL
docker-compose exec postgres psql -U admin -d rationalization

# Redis
docker-compose exec redis redis-cli

# Neo4j Cypher Shell
docker-compose exec neo4j cypher-shell -u neo4j -p changeme123
```

#### Inspect Database

```bash
# PostgreSQL: List applications
docker-compose exec postgres psql -U admin -d rationalization -c \
  "SELECT id, name, type, stars FROM applications LIMIT 10;"

# Redis: Check cache
docker-compose exec redis redis-cli KEYS "app:*"
docker-compose exec redis redis-cli GET "app:some-id"
```

## Common Tasks

### Reset Everything

```bash
# Stop all containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Rebuild images
docker-compose build --no-cache

# Start fresh
docker-compose up -d
```

### Update Dependencies

```bash
# Node.js services
cd backend/catalog-api
npm update
npm audit fix

# Python services
cd backend/ai-classifier
pip install --upgrade -r requirements.txt
```

### Backup Database

```bash
# PostgreSQL backup
docker-compose exec postgres pg_dump -U admin rationalization > backup.sql

# Restore
docker-compose exec -T postgres psql -U admin rationalization < backup.sql

# Neo4j backup
docker-compose exec neo4j neo4j-admin dump --to=/backups/neo4j.dump
```

## Troubleshooting

### Services Won't Start

```bash
# Check Docker daemon
docker info

# Check port conflicts
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Check disk space
df -h

# View service health
docker-compose ps
```

### Database Connection Errors

```bash
# Check if database is ready
docker-compose exec postgres pg_isready -U admin

# Verify credentials
docker-compose exec postgres psql -U admin -d rationalization -c "\dt"

# Check Neo4j status
docker-compose exec neo4j cypher-shell -u neo4j -p changeme123 "RETURN 1"
```

### AI Classifier Not Working

```bash
# Check if OpenAI API key is set
docker-compose exec ai-classifier env | grep OPENAI

# Test manually
curl http://localhost:8001/health

# Check logs
docker-compose logs ai-classifier
```

### GitHub Crawler Rate Limited

```bash
# Check rate limit
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/rate_limit

# Wait for reset or add more tokens
# GitHub allows 5000 requests/hour per token
```

## Next Steps

1. **Explore the API**: Try the [API examples](./docs/api/examples.md)
2. **Read Architecture**: Understand the [system architecture](./docs/architecture/README.md)
3. **Create Blueprints**: Learn about [blueprints](./docs/guides/blueprints.md)
4. **Deploy to Production**: Follow the [deployment guide](./docs/guides/deployment.md)
5. **Contribute**: Read the [contributing guidelines](./CONTRIBUTING.md)

## Resources

- [Full Documentation](./docs/)
- [API Reference](./docs/api/)
- [Architecture Overview](./docs/architecture/)
- [GraphQL Schema](./backend/catalog-api/src/graphql/schema.js)
- [Database Schema](./backend/catalog-api/schema.sql)

## Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Email**: support@rationalization.dev

## License

MIT License - see [LICENSE](./LICENSE) file for details.
