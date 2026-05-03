#!/bin/bash
set -euo pipefail

echo "[post-merge] installing dependencies..."
npm install --no-audit --no-fund --prefer-offline

echo "[post-merge] pushing drizzle schema..."
npm run db:push -- --force || npm run db:push

echo "[post-merge] done."
