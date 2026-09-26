#!/usr/bin/env bash
# Genera un unico file SQL con tutte le migration in ordine, da incollare
# nell'SQL Editor della dashboard Supabase quando non si usa la CLI.
#
#   npm run db:sql   ->   docs/schema-completo.sql
#
# Il file registra anche le migration in supabase_migrations.schema_migrations,
# così se in futuro si passa alla CLI `supabase db push` non le riapplica.
set -euo pipefail

SORGENTE="supabase/migrations"
DESTINAZIONE="docs/schema-completo.sql"

mkdir -p "$(dirname "$DESTINAZIONE")"

{
  cat <<'HEADER'
-- ============================================================================
-- FILE GENERATO — non modificare a mano.
-- Rigeneralo con:  npm run db:sql
-- Sorgente: supabase/migrations/*.sql (quelle restano la fonte di verità)
--
-- USO: dashboard Supabase -> SQL Editor -> New query -> incolla tutto -> Run.
--      Va eseguito UNA VOLTA SOLA: crea tabelle, policy, viste e funzioni.
--      Se lo esegui due volte la seconda si ferma con "already exists" senza
--      aver modificato nulla (gira tutto in un'unica transazione).
-- ============================================================================

begin;

HEADER

  for file in "$SORGENTE"/*.sql; do
    nome="$(basename "$file")"
    echo ""
    echo "-- ┌──────────────────────────────────────────────────────────────────────"
    echo "-- │ $nome"
    echo "-- └──────────────────────────────────────────────────────────────────────"
    echo ""
    cat "$file"
  done

  cat <<'FOOTER'

-- ┌──────────────────────────────────────────────────────────────────────
-- │ Registrazione delle migration applicate
-- │
-- │ Serve perché una futura `supabase db push` sappia che questo schema
-- │ c'è già e applichi soltanto le migration successive.
-- └──────────────────────────────────────────────────────────────────────

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

FOOTER

  for file in "$SORGENTE"/*.sql; do
    nome="$(basename "$file" .sql)"
    versione="${nome%%_*}"
    etichetta="${nome#*_}"
    echo "insert into supabase_migrations.schema_migrations (version, name)"
    echo "values ('${versione}', '${etichetta}')"
    echo "on conflict (version) do nothing;"
    echo ""
  done

  cat <<'FOOTER2'
commit;

-- Controllo finale: le quattro tabelle devono avere RLS attiva.
select
  relname as tabella,
  relrowsecurity as rls_attiva,
  relforcerowsecurity as rls_forzata
from pg_class
where relname in ('profiles', 'itineraries', 'stops', 'legs')
  and relnamespace = 'public'::regnamespace
order by relname;
FOOTER2
} > "$DESTINAZIONE"

righe=$(wc -l < "$DESTINAZIONE")
echo "✓ Generato $DESTINAZIONE ($righe righe)"
