# daten5 — Концепция рационализации и Rationalization Platform

Репозиторий объединяет концептуальный документ `rationalization-proposal.md` («Концепция рационализации цифровой экосистемы») и многосервисную платформу `rationalization-platform/` — мета-слой («B2B Operating System for the Internet») для каталогизации, анализа, классификации и интеграции существующих программных решений.

## Состав и структура репозитория (`main`)

```text
├── LICENSE                        # Лицензия GNU AGPL v3
├── README.md                      # Документация репозитория
├── rationalization-proposal.md    # Концепция рационализации цифровой экосистемы
└── rationalization-platform/
    ├── .env.example               # Шаблон переменных окружения
    ├── GETTING_STARTED.md         # Руководство по запуску и примеры запросов
    ├── README.md                  # Обзор платформы
    ├── docker-compose.yml         # Оркестрация БД, брокера, мониторинга и сервисов
    ├── docs/
    │   └── architecture/README.md # Описание архитектуры
    ├── backend/
    │   ├── catalog-api/           # Node.js + Express + Apollo Server (REST + GraphQL, схемы PostgreSQL/pgvector и Neo4j)
    │   ├── api-gateway/           # Node.js + Express прокси, rate limiting (Redis), метрики Prometheus
    │   ├── blueprint-engine/      # Node.js + Express + Bull + node-cron + schema.sql
    │   ├── ai-classifier/         # Python + FastAPI (классификация и семантический поиск)
    │   ├── github-crawler/        # Python-краулер репозиториев GitHub
    │   ├── nl-interface/          # Python-сервис обработки естественного языка
    │   └── solution-composer/     # Python-сервис композиции решений
    └── frontend/
        └── web-app/               # Next.js 14 + React 18 + TypeScript + Tailwind CSS
```

## Проверенный технологический стек

- **Backend (Node.js 18+):**
  - `catalog-api`: Express, `@apollo/server` (GraphQL), `pg` / `pg-promise` (`schema.sql` с `pgvector`), `neo4j-driver` (`neo4j-schema.cypher`), `redis` / `ioredis`, `@elastic/elasticsearch`, `openai`, `swagger-ui-express`, `jest`.
  - `api-gateway`: Express, `http-proxy-middleware`, `express-rate-limit`, `rate-limit-redis`, `prom-client`, `jsonwebtoken`, `swagger-ui-express`.
  - `blueprint-engine`: Express, `bull`, `node-cron`, `pg-promise`, `ioredis`, `jsonschema`, `yaml`.
- **Backend (Python 3.11+):** `ai-classifier`, `github-crawler`, `nl-interface`, `solution-composer` (FastAPI/Python-сервисы с собственными `Dockerfile`, `main.py` и `requirements.txt`).
- **Frontend (`frontend/web-app/`):** Next.js `14.0.4` (App Router: `app/applications`, `app/chat`), React 18, TypeScript 5, Tailwind CSS, `@tanstack/react-query`, `zustand`, `react-markdown`, `lucide-react`.
- **Инфраструктура (`rationalization-platform/docker-compose.yml`):** PostgreSQL (`ankane/pgvector:latest`), Neo4j `5.14-community`, Redis `7-alpine`, Elasticsearch `8.11.0`, RabbitMQ `3.12-management-alpine`, Prometheus, Grafana.

## Запуск и команды

### Через Docker Compose

```bash
cd rationalization-platform
cp .env.example .env
docker-compose up -d
docker-compose ps
```

Порты сервисов по `rationalization-platform/docker-compose.yml`:
- `web-app`: `http://localhost:3002`
- `api-gateway`: `http://localhost:8000`
- `catalog-api`: `http://localhost:3000` (REST `/api`, GraphQL `/graphql`)
- `ai-classifier`: `http://localhost:8001`
- `nl-interface`: `http://localhost:8002`
- `solution-composer`: `http://localhost:8003`
- `neo4j`: `http://localhost:7474` (HTTP) / `7687` (Bolt)
- `rabbitmq`: `http://localhost:15672` (Management UI)
- `prometheus`: `http://localhost:9090`, `grafana`: `http://localhost:3001`

### Локальный запуск отдельных сервисов

```bash
# Catalog API (Node.js)
cd rationalization-platform/backend/catalog-api
npm install
npm run dev       # или npm start / npm test / npm run lint

# Web App (Next.js)
cd rationalization-platform/frontend/web-app
npm install
npm run dev       # порт 3002; также доступны build, start, lint

# AI Classifier (Python + FastAPI)
cd rationalization-platform/backend/ai-classifier
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# GitHub Crawler (Python)
cd rationalization-platform/backend/github-crawler
pip install -r requirements.txt
python main.py
```

> **Примечание:** в корне `rationalization-platform/` нет единого `package.json`, а в `catalog-api/` отсутствует каталог `scripts/` (команды `migrate`/`seed` в `catalog-api/package.json` ссылаются на ещё не добавленные скрипты `scripts/migrate.js` и `scripts/seed.js`; начальная схема PostgreSQL подключается через `./backend/catalog-api/schema.sql` в `docker-compose.yml`). Также в `docker-compose.yml` упоминаются примонтированные конфигурации `./infrastructure/...`, каталог которых в текущем дереве файлов отсутствует.

## Ветки репозитория

- `main` — защищённая основная ветка с концепцией (`rationalization-proposal.md`) и платформой (`rationalization-platform/`).
- `claude/fix-api-data-refresh-8IrOf` — ветка разработки фаз 1–4; изменения уже влиты в `main` через закрытый PR [#1](../../pull/1) (ветка осталась в репозитории на состоянии до добавления файла `LICENSE`).
- `codex/readme-overview-20261118` — неслитая ветка с открытым draft PR [#2](../../pull/2) («Add concise project README»), добавляющим краткий обзорный `README.md`.

## Лицензия

В ветке `main` репозиторий распространяется под лицензией **GNU Affero General Public License v3** (см. файл `LICENSE`). В `package.json` сервисов и в `rationalization-platform/README.md` упоминается лицензия MIT.
