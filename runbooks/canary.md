# Canary & Rollback (Local Demo)

This runbook shows how to spin up a **canary API** alongside the main API, send ~10% traffic to it with k6, watch SLOs, and roll back if needed.

## Prereqs
- Docker & docker compose
- Prometheus & Grafana already running via `docker compose up -d`
- k6 installed (Windows: `winget install grafana.k6` or `choco install k6`)

## Start Canary (Compose override)

```bash
# build base image
docker compose build api

# bring up a second API on port 8001 using the override file
docker compose -f docker-compose.yml -f docker-compose.canary.yml up -d api_canary
