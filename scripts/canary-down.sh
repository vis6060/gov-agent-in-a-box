#!/usr/bin/env bash
set -euo pipefail

echo "[*] Stopping canary..."
docker compose -f docker-compose.yml -f docker-compose.canary.yml down api_canary || true
