# Indexer (required for full history)

This service ingests on-chain logs into Postgres and exposes an HTTP API for the web UI.

## Run Postgres

From repo root:

```bash
docker compose up -d
```

## Configure

```bash
cd indexer
cp .env.example .env
```

Edit `.env`:
- `FACTORY_ADDRESS`: your deployed `MarketFactory` address
- `RISE_RPC`: a reliable RPC (public RPCs may rate limit)
- `DATABASE_URL`: defaults to the docker-compose Postgres

## Install + run

```bash
npm install
npm run dev
```

API:
- `GET /health`
- `GET /markets`
- `GET /markets/:address/events?limit=200&fromId=123`

