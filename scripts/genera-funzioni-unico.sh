#!/usr/bin/env bash
# Genera una versione "in un solo file" di ogni Edge Function, da incollare
# nell'editor della dashboard Supabase quando non si usa la CLI.
#
#   npm run fn:bundle   ->   docs/edge-functions/<nome>.ts
#
# I moduli di supabase/functions/_shared vengono messi in testa al file e le
# righe di import relative eliminate: il risultato è autosufficiente.
# La fonte di verità resta supabase/functions/**: questi file sono generati.
set -euo pipefail

SORGENTE="supabase/functions"
DESTINAZIONE="docs/edge-functions"

mkdir -p "$DESTINAZIONE"

# Rimuove gli import relativi (./ e ../): nel file unico i moduli sono già presenti.
senza_import_relativi() {
  # Gli import relativi di queste funzioni stanno sempre su una riga sola.
  grep -vE "^import .* from '(\./|\.\./)" "$1"
}

genera() {
  local nome="$1"
  shift
  local moduli=("$@")
  local uscita="$DESTINAZIONE/$nome.ts"

  {
    cat <<HEADER
// ============================================================================
// FILE GENERATO — non modificare a mano.
// Rigeneralo con:  npm run fn:bundle
// Sorgente: supabase/functions/$nome/ + supabase/functions/_shared/
//
// USO senza CLI: dashboard Supabase -> Edge Functions -> Deploy a new function
//                -> nome "$nome" -> incolla tutto questo file -> Deploy.
//
// Con la CLI non serve: npx supabase functions deploy $nome
// ============================================================================

HEADER

    for modulo in "${moduli[@]}"; do
      echo "// ─── da _shared/$modulo ───"
      senza_import_relativi "$SORGENTE/_shared/$modulo"
      echo ""
    done

    echo "// ─── $nome/index.ts ───"
    senza_import_relativi "$SORGENTE/$nome/index.ts"
  } > "$uscita"

  echo "✓ $uscita ($(wc -l < "$uscita") righe)"
}

genera calculate-route tipi.ts geo.ts http.ts providers/percorsi.ts
genera geocode tipi.ts http.ts providers/luoghi.ts
