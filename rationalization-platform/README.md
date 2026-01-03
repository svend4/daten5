# Rationalization Platform

**B2B Operating System for the Internet**

A comprehensive platform for integrating, cataloging, and rationalizing existing digital solutions instead of reinventing the wheel.

## 🎯 Mission

Transform the fragmented internet ecosystem into a coherent, interconnected system where existing solutions work together seamlessly.

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web App    │  │     CLI      │  │  VS Code Ext │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ REST/GraphQL
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway Layer                          │
│  - Protocol Translation  - Auth  - Rate Limiting            │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Catalog API  │  │  Blueprint   │  │  AI Service  │
│              │  │   Engine     │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Neo4j     │  │  Vector DB   │      │
│  │  (Catalog)   │  │   (Graph)    │  │  (Semantic)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   GitHub     │  │     NPM      │  │  WordPress   │
│   Crawler    │  │   Crawler    │  │   Crawler    │
└──────────────┘  └──────────────┘  └──────────────┘
```

## 🏗️ Project Structure

```
rationalization-platform/
├── backend/
│   ├── catalog-api/          # Universal Catalog REST/GraphQL API
│   ├── github-crawler/       # GitHub repository analyzer
│   ├── ai-classifier/        # AI-based classification service
│   ├── api-gateway/          # Central API gateway
│   ├── blueprint-engine/     # Workflow/blueprint execution engine
│   └── compatibility-engine/ # Compatibility testing
├── frontend/
│   ├── web-app/             # React web application
│   └── cli/                 # Command-line interface
├── infrastructure/
│   ├── docker/              # Docker configurations
│   ├── kubernetes/          # K8s manifests
│   └── terraform/           # Infrastructure as code
├── docs/
│   ├── api/                 # API documentation
│   ├── architecture/        # Architecture docs
│   └── guides/              # User guides
└── scripts/                 # Utility scripts
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- Neo4j 5+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd rationalization-platform

# Start infrastructure services
docker-compose up -d

# Install dependencies
cd backend/catalog-api && npm install
cd ../github-crawler && pip install -r requirements.txt

# Run migrations
npm run migrate

# Start services
npm run dev
```

## 📚 Documentation

- [Architecture Guide](./docs/architecture/README.md)
- [API Reference](./docs/api/README.md)
- [Developer Guide](./docs/guides/developer-guide.md)
- [Deployment Guide](./docs/guides/deployment.md)

## 🔧 Technology Stack

### Backend
- **Catalog API**: Node.js + Express + GraphQL
- **Crawlers**: Python + Scrapy + BeautifulSoup
- **AI Service**: Python + FastAPI + OpenAI/HuggingFace
- **Databases**: PostgreSQL (pgvector), Neo4j, Redis

### Frontend
- **Web App**: React + Next.js + TypeScript
- **UI**: Tailwind CSS + Shadcn/ui
- **State**: Zustand + React Query
- **Visualization**: D3.js + Recharts

### Infrastructure
- **Containers**: Docker + Docker Compose
- **Orchestration**: Kubernetes
- **IaC**: Terraform
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

## 📈 Development Roadmap

### Phase 1: Inventory (Current)
- [x] Project structure
- [ ] Database schema
- [ ] Basic Catalog API
- [ ] GitHub crawler
- [ ] AI classification

### Phase 2: Integration Layer
- [ ] API Gateway
- [ ] Blueprint platform
- [ ] Compatibility engine

### Phase 3: AI Assistant
- [ ] NL interface
- [ ] Solution composer
- [ ] Learning system

### Phase 4: Ecosystem
- [ ] Web application
- [ ] Marketplace
- [ ] Community features

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run specific service tests
cd backend/catalog-api && npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) file

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📞 Contact

- GitHub Issues: [Report bugs](https://github.com/your-repo/issues)
- Discussions: [Community forum](https://github.com/your-repo/discussions)
