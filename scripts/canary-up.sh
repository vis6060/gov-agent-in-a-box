#!/usr/bin/env bash
set -euo pipefail

echo "[*] Building base API image..."
docker compose build api

echo "[*] Starting canary on :8001..."
docker compose -f docker-compose.yml -f docker-compose.canary.yml up -d api_canary

echo "[*] Health checks:"
echo "  main:   $(curl -sS http://localhost:8000/health || echo 'unreachable')"
echo "  canary: $(curl -sS http://localhost:8001/health || echo 'unreachable')"
