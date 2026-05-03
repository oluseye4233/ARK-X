#!/bin/bash
set -euo pipefail

echo "[post-merge] installing dependencies..."
npm install --no-audit --no-fund --prefer-offline

# Schema migrations: each task that changes shared/schema.ts must ship a
# matching idempotent SQL file in migrations/ (see 0000_phase_j_pdd_alignment.sql).
# Server bootstrap applies them on next start. We deliberately do NOT run
# `drizzle-kit push` here because it is interactive on schema drift and stdin
# is closed during post-merge.

echo "[post-merge] done."
