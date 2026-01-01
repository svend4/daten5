# Rationalization Platform - Architecture

## Overview

The Rationalization Platform is a B2B operating system for the internet that catalogs, integrates, and rationalizes existing digital solutions instead of reinventing the wheel.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Web App    │  │  Mobile App  │  │     CLI      │  │  VS Code    │ │
│  │  (Next.js)   │  │ (React Nat.) │  │  (Node.js)   │  │  Extension  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
┌───────────────────▼────────────────────────────▼──────────────────────┐
│                        API GATEWAY LAYER                              │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  API Gateway (Node.js + Express)                              │   │
│  │  - Authentication & Authorization                             │   │
│  │  - Rate Limiting                                              │   │
│  │  - Request Routing                                            │   │
│  │  - Protocol Translation                                       │   │
│  │  - Response Caching                                           │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼────────┐  ┌─────────────▼──────────┐  ┌──────────▼─────────┐
│  Catalog API   │  │   AI Classifier        │  │  Blueprint Engine  │
│  (Node.js)     │  │   (Python/FastAPI)     │  │  (Node.js)         │
│                │  │                        │  │                    │
│  REST + GraphQL│  │  - Classification      │  │  - Workflow Exec   │
│  - CRUD Apps   │  │  - Embeddings          │  │  - Integration     │
│  - Search      │  │  - Semantic Search     │  │  - Orchestration   │
│  - Analytics   │  │  - NLP Processing      │  │                    │
└────────────────┘  └────────────────────────┘  └────────────────────┘
        │                         │                         │
        └─────────────────────────┼─────────────────────────┘
                                  │
┌─────────────────────────────────▼──────────────────────────────────────┐
│                           DATA LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  PostgreSQL  │  │    Neo4j     │  │    Redis     │  │Elasticsearch│ │
│  │   (Primary)  │  │   (Graph)    │  │   (Cache)    │  │  (Search)  │ │
│  │              │  │              │  │              │  │            │ │
│  │ + pgvector   │  │  Relations   │  │  Sessions    │  │ Full-text  │ │
│  │   Embeddings │  │  Knowledge   │  │  Rate Limit  │  │  Semantic  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼──────────────────────────────────────┐
│                        BACKGROUND WORKERS                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   GitHub     │  │     NPM      │  │  WordPress   │  │  Compat.   │ │
│  │   Crawler    │  │   Crawler    │  │   Crawler    │  │  Tester    │ │
│  │  (Python)    │  │  (Python)    │  │  (Python)    │  │ (Node.js)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼──────────────────────────────────────┐
│                      MONITORING & OBSERVABILITY                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Prometheus  │  │   Grafana    │  │   Sentry     │  │   Logs     │ │
│  │  (Metrics)   │  │  (Dashboards)│  │   (Errors)   │  │  (ELK)     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Catalog API (Node.js + Express + GraphQL)

**Purpose**: Universal catalog of all digital solutions

**Responsibilities**:
- CRUD operations for applications, blueprints, capabilities
- REST and GraphQL APIs
- Query optimization and caching
- Integration with all databases

**Tech Stack**:
- Runtime: Node.js 18+
- Framework: Express.js
- API: GraphQL (Apollo Server)
- ORM: pg-promise
- Validation: express-validator

**Database Access**:
- PostgreSQL: Primary data store
- Neo4j: Relationship queries
- Redis: Caching layer
- Elasticsearch: Full-text search

**Key Endpoints**:
```
GET    /api/applications           # List applications
GET    /api/applications/:id       # Get application
POST   /api/applications           # Create application
PUT    /api/applications/:id       # Update application
DELETE /api/applications/:id       # Delete application

GET    /api/capabilities           # List capabilities
GET    /api/blueprints             # List blueprints
POST   /api/search                 # Global search

POST   /graphql                    # GraphQL endpoint
```

### 2. AI Classifier (Python + FastAPI)

**Purpose**: AI-powered classification and semantic analysis

**Responsibilities**:
- Generate embeddings using OpenAI or local models
- Classify applications by type and capabilities
- Semantic search
- Natural language processing
- Batch processing

**Tech Stack**:
- Runtime: Python 3.11+
- Framework: FastAPI
- AI/ML: OpenAI API, Sentence Transformers
- Vector DB: pgvector

**Key Features**:
- Automatic application classification
- Embedding generation (1536-dimensional vectors)
- Semantic similarity search
- Capability extraction from descriptions
- Tag suggestion

**Endpoints**:
```
POST /classify              # Classify application
POST /embedding             # Generate embedding
POST /semantic-search       # Semantic search
POST /batch-classify        # Batch classification
```

### 3. GitHub Crawler (Python)

**Purpose**: Automatically discover and analyze GitHub repositories

**Responsibilities**:
- Search GitHub for popular repositories
- Extract metadata (stars, forks, language, etc.)
- Parse README and documentation
- Detect dependencies from package files
- Store in databases
- Update Neo4j graph relationships

**Tech Stack**:
- Runtime: Python 3.11+
- GitHub API: PyGithub
- Database: psycopg2, neo4j-driver
- Task Queue: Celery + RabbitMQ

**Features**:
- Rate limit handling
- Dependency extraction (npm, pip, go.mod, etc.)
- Language detection
- Topic/tag extraction
- Incremental updates

**Supported Package Managers**:
- npm (package.json)
- pip (requirements.txt)
- go modules (go.mod)
- maven (pom.xml)
- composer (composer.json)

### 4. API Gateway (Node.js + Express)

**Purpose**: Central entry point for all client requests

**Responsibilities**:
- Route requests to appropriate services
- Authentication and authorization
- Rate limiting (global and per-endpoint)
- Request/response transformation
- Caching
- CORS handling
- API versioning

**Tech Stack**:
- Runtime: Node.js 18+
- Framework: Express.js
- Rate Limiting: express-rate-limit + Redis
- Auth: JWT

**Features**:
- Service discovery
- Circuit breaker pattern
- Request aggregation
- Protocol translation (REST ↔ GraphQL)
- Response compression

### 5. Blueprint Engine (Future)

**Purpose**: Execute and orchestrate integration workflows

**Responsibilities**:
- Parse blueprint definitions
- Execute workflow steps
- Manage API integrations
- Handle errors and retries
- Monitor execution

## Data Architecture

### PostgreSQL Schema

**Core Tables**:
1. `applications` - All cataloged software
2. `capabilities` - Hierarchical capability taxonomy
3. `blueprints` - Pre-configured solution templates
4. `dependencies` - Application dependencies
5. `alternatives` - Similar/competing applications
6. `compatibility` - Compatibility matrix
7. `api_endpoints` - API specifications
8. `reviews` - User reviews and ratings
9. `use_cases` - Problem descriptions

**Key Features**:
- pgvector extension for semantic search
- Full-text search indexes
- Materialized views for analytics
- Automatic timestamp updates
- JSONB for flexible metadata

### Neo4j Graph Model

**Nodes**:
- `Application` - Software applications
- `Capability` - Functionalities
- `Technology` - Programming languages, frameworks
- `Company` - Organizations
- `Blueprint` - Solution templates

**Relationships**:
- `[:DEPENDS_ON]` - Dependencies
- `[:HAS_CAPABILITY]` - Capabilities
- `[:SIMILAR_TO]` - Alternatives
- `[:COMPATIBLE_WITH]` - Compatibility
- `[:BUILT_WITH]` - Technologies
- `[:MAINTAINED_BY]` - Ownership
- `[:INTEGRATES_WITH]` - Integrations

**Graph Algorithms**:
- PageRank - Find influential applications
- Community Detection - Cluster applications
- Shortest Path - Find integration paths
- Node Similarity - Recommend alternatives

### Redis Usage

**Cache Keys**:
```
app:{id}                    # Application details
apps:list:{filters}         # Application lists
capabilities:all            # All capabilities
blueprints:popular          # Popular blueprints
search:{query}              # Search results

rate_limit:{ip}             # Rate limiting
session:{token}             # User sessions
```

**TTL Strategy**:
- Application details: 5 minutes
- Lists: 1 minute
- Search results: 30 seconds
- Rate limits: 1 minute

### Elasticsearch Indexes

**Indexes**:
1. `applications` - Application search
2. `blueprints` - Blueprint search
3. `capabilities` - Capability search

**Search Features**:
- Multi-field search
- Fuzzy matching
- Phrase matching
- Boosting (name^3, description^2, tags^1)
- Filtering by type, source, verified

## Data Flow

### 1. Application Discovery

```
GitHub API
    │
    ▼
GitHub Crawler
    │
    ├──▶ Extract metadata
    │
    ├──▶ Parse dependencies
    │
    ▼
Save to PostgreSQL
    │
    ▼
Generate embedding (AI Classifier)
    │
    ▼
Update PostgreSQL + Neo4j
    │
    ▼
Index in Elasticsearch
    │
    ▼
Invalidate cache (Redis)
```

### 2. Semantic Search

```
User Query
    │
    ▼
API Gateway
    │
    ▼
Generate query embedding (AI Classifier)
    │
    ▼
Vector similarity search (PostgreSQL pgvector)
    │
    ▼
Enrich with graph data (Neo4j)
    │
    ▼
Cache result (Redis)
    │
    ▼
Return to user
```

### 3. Blueprint Execution

```
User selects blueprint
    │
    ▼
Blueprint Engine
    │
    ├──▶ Validate compatibility
    │
    ├──▶ Check dependencies
    │
    ├──▶ Execute workflow steps
    │        │
    │        ├──▶ Call external APIs
    │        │
    │        ├──▶ Configure services
    │        │
    │        └──▶ Verify success
    │
    ▼
Track execution (PostgreSQL)
    │
    ▼
Return result + deployment URL
```

## Scaling Strategy

### Horizontal Scaling

**Stateless Services** (can scale horizontally):
- Catalog API (multiple instances behind load balancer)
- AI Classifier (multiple workers)
- API Gateway (multiple instances)
- Crawlers (distributed workers)

**Load Balancing**:
- Use Nginx or HAProxy
- Round-robin distribution
- Health check endpoints
- Session affinity (sticky sessions)

### Vertical Scaling

**Databases**:
- PostgreSQL: Increase CPU/RAM for complex queries
- Neo4j: Increase heap size for graph traversal
- Redis: Increase memory for caching

### Caching Strategy

**Levels**:
1. **Client-side**: Browser cache (static assets)
2. **API Gateway**: Response cache (Redis)
3. **Service-level**: Database query cache
4. **Database**: Query plan cache

**Cache Invalidation**:
- Time-based (TTL)
- Event-based (on updates)
- Tag-based (invalidate groups)

### Database Optimization

**PostgreSQL**:
- Connection pooling (max 20 connections)
- Index optimization
- Materialized views for analytics
- Partitioning large tables (by date)

**Neo4j**:
- Query optimization (EXPLAIN)
- Index on frequently queried properties
- Periodic compaction

**Redis**:
- Memory limits with LRU eviction
- Persistence (AOF + RDB)
- Cluster mode for high availability

## Security

### Authentication & Authorization

**Methods**:
- JWT tokens (stateless)
- API keys (for service-to-service)
- OAuth 2.0 (for third-party integrations)

**Token Structure**:
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "roles": ["user", "admin"],
  "exp": 1234567890,
  "iat": 1234567890
}
```

### Rate Limiting

**Limits**:
- Anonymous: 100 requests/minute
- Authenticated: 1000 requests/minute
- Enterprise: 10,000 requests/minute

**Implementation**:
- Redis-backed rate limiter
- Sliding window algorithm
- Per-IP and per-user limits

### Data Protection

**Encryption**:
- TLS 1.3 for all connections
- Database encryption at rest
- Secret management (environment variables)

**PII Handling**:
- Minimal collection
- Anonymization for analytics
- GDPR compliance

## Monitoring & Observability

### Metrics (Prometheus)

**Application Metrics**:
- Request rate (requests/second)
- Error rate (errors/total requests)
- Response time (p50, p95, p99)
- Database query time

**Infrastructure Metrics**:
- CPU usage
- Memory usage
- Disk I/O
- Network bandwidth

### Logging

**Structured Logging** (JSON format):
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "service": "catalog-api",
  "message": "Application created",
  "app_id": "uuid",
  "user_id": "uuid",
  "duration_ms": 45
}
```

**Log Levels**:
- ERROR: Errors requiring attention
- WARN: Potential issues
- INFO: Important events
- DEBUG: Detailed debugging

### Tracing

**Distributed Tracing**:
- Trace ID propagation across services
- Span tracking for each operation
- Performance bottleneck identification

### Alerts

**Critical Alerts**:
- Service down (>5 minutes)
- Error rate >5%
- Response time >2 seconds (p95)
- Database connection pool exhausted

**Warning Alerts**:
- Memory usage >80%
- Disk usage >85%
- Rate limit approaching

## Deployment

### Docker Compose (Development)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f catalog-api

# Stop services
docker-compose down
```

### Kubernetes (Production)

**Resources**:
```yaml
# Deployment example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: catalog-api
  template:
    spec:
      containers:
      - name: catalog-api
        image: rationalization/catalog-api:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

### CI/CD Pipeline

**Stages**:
1. **Build**: Build Docker images
2. **Test**: Run unit + integration tests
3. **Scan**: Security scanning (Snyk)
4. **Deploy**: Deploy to staging
5. **E2E Tests**: End-to-end tests
6. **Deploy Production**: Blue-green deployment

## Performance Targets

### Response Times

- API endpoints: <100ms (p95)
- GraphQL queries: <200ms (p95)
- Search: <300ms (p95)
- Semantic search: <500ms (p95)

### Throughput

- 10,000 requests/second (API Gateway)
- 5,000 concurrent users
- 1 million applications in catalog
- 100,000 blueprints

### Availability

- 99.9% uptime (8.76 hours downtime/year)
- Recovery Time Objective (RTO): <1 hour
- Recovery Point Objective (RPO): <15 minutes

## Future Enhancements

### Phase 2
- Blueprint execution engine
- Compatibility testing automation
- Marketplace for blueprints
- Community features (comments, ratings)

### Phase 3
- AI-powered solution composer
- Natural language interface
- Automated integration code generation
- Learning from successful deployments

### Phase 4
- Multi-tenancy
- White-label solution
- Enterprise features (SSO, audit logs)
- Advanced analytics

## References

- [API Documentation](../api/README.md)
- [Developer Guide](../guides/developer-guide.md)
- [Deployment Guide](../guides/deployment.md)
