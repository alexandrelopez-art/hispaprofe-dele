#!/usr/bin/env bash
# Levanta un Postgres de usar y tirar, aplica las migraciones y corre las pruebas
# que necesitan base. Al terminar lo para y borra los datos.
set -euo pipefail

PUERTO=55432
DATOS="$(pwd)/.tmp/pg"
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

if ! command -v initdb >/dev/null; then
  echo "Falta Postgres. Instálalo con: brew install postgresql@17" >&2
  exit 1
fi

limpiar() {
  pg_ctl -D "$DATOS" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$DATOS"
}
trap limpiar EXIT

rm -rf "$DATOS"
initdb -D "$DATOS" -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$DATOS" -o "-p $PUERTO -k $DATOS" -l "$DATOS/servidor.log" start >/dev/null
for _ in $(seq 1 20); do
  psql -h 127.0.0.1 -p "$PUERTO" -U postgres -c "select 1" >/dev/null 2>&1 && break
  sleep 0.5
done
psql -h 127.0.0.1 -p "$PUERTO" -U postgres -c "create database pruebas" >/dev/null

export DATABASE_URL="postgresql://postgres@127.0.0.1:$PUERTO/pruebas"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy
npx vitest run --config vitest.base.config.ts "$@"
