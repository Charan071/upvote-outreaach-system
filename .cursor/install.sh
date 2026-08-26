#!/usr/bin/env bash
# Idempotent dependency + database bootstrap for the Launchlist Cloud Agent
# environment. Safe to run repeatedly (build snapshot + local re-runs).
set -euo pipefail
cd "$(dirname "$0")/.."

# 1) System dependency: PostgreSQL (mirrors docker-compose.yml for local dev).
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

PG_VER="$(ls /etc/postgresql | sort -n | tail -1)"

# 2) The cluster must be up so we can create the role/db and sync the schema.
sudo pg_ctlcluster "$PG_VER" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  sudo -u postgres pg_isready -q && break
  sleep 1
done

# 3) Role + database matching docker-compose.yml / .env.example (idempotent).
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='outreach'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE outreach WITH LOGIN CREATEDB PASSWORD 'outreach';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='outreach'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE outreach OWNER outreach;"

# 4) Local .env (external API keys stay blank; features that need them no-op).
if [ ! -f .env ]; then
  cp .env.example .env
fi

# 5) Node dependencies. `postinstall` runs `prisma generate`.
npm install

# 6) Sync schema and seed the baseline settings row (both idempotent).
npm run db:push
npm run db:seed

echo "install.sh: done"
