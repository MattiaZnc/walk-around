#!/usr/bin/env bash
# Esegue gli script SQL di test sul database Supabase locale.
#
# Usa psql dentro il container del DB, così non serve installare il client
# Postgres sulla macchina. Ogni script gira in una transazione con rollback:
# non lascia dati dietro di sé.
#
#   npm run db:test
#
set -euo pipefail

CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_walk-around}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Il container '$CONTAINER' non è attivo." >&2
  echo "Avvia lo stack locale con: npx supabase start" >&2
  exit 1
fi

fallimenti=0

for file in supabase/tests/*.sql; do
  echo "──────────────────────────────────────────────"
  echo "▶ $file"
  if docker exec -i "$CONTAINER" psql -U postgres -d postgres \
      --quiet -v ON_ERROR_STOP=1 -f - < "$file"; then
    :
  else
    echo "✗ $file: test falliti" >&2
    fallimenti=$((fallimenti + 1))
  fi
done

echo "──────────────────────────────────────────────"
if [ "$fallimenti" -gt 0 ]; then
  echo "✗ $fallimenti file di test con errori" >&2
  exit 1
fi
echo "✓ Tutti i test SQL sono passati"
