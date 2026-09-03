#!/usr/bin/env bash
# Per-boot reconciliation: bring PostgreSQL online before the dev server starts.
# Data (role/db/schema/seed) lives in the environment snapshot from install.sh;
# this only starts the server process and self-heals if anything is missing.
set -euo pipefail
cd "$(dirname "$0")/.."

PG_VER="$(ls /etc/postgresql | sort -n | tail -1)"

sudo pg_ctlcluster "$PG_VER" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  sudo -u postgres pg_isready -q && break
  sleep 1
done

sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='outreach'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE outreach WITH LOGIN CREATEDB PASSWORD 'outreach';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='outreach'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE outreach OWNER outreach;"

# Cheap, idempotent schema sync in case the snapshot predates a schema change.
npm run db:push >/dev/null 2>&1 || true

echo "start.sh: PostgreSQL ready on localhost:5432"
