#!/usr/bin/env bash
# Banc e2e de l'essai sans compte, 100 % local : Postgres jetable (le
# brouillon essai_sans_compte.sql y tourne pour de bon) + faux Supabase
# (auth, stockage, fonction d'estimation) + site en production + Playwright.
#
#   ./run.sh "postgresql://postgres@localhost:5432/tiroir_essai_e2e"
#
# La base doit être VIDE et jetable. Captures dans ./shots. Ne touche ni
# prod ni preprod, n'appelle aucun modèle.
set -euo pipefail
DB="${1:?Usage : ./run.sh URL_BASE_VIDE}"
HERE="$(cd "$(dirname "$0")" && pwd)"
DRAFTS="$HERE/../../../supabase/drafts"
WEB="$HERE/../../../web"
export SHOTS="$HERE/shots" E2E_DB="$DB" PORT="${PORT:-8152}"; mkdir -p "$SHOTS"

psql "$DB" -q -v ON_ERROR_STOP=1 -f "$DRAFTS/tests/stub_essai.sql" >/dev/null
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/setup.sql" >/dev/null
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$DRAFTS/essai_sans_compte.sql" >/dev/null

cleanup() { kill ${PIDS:-} 2>/dev/null || true; pkill -f "next-server" 2>/dev/null || true; }
trap cleanup EXIT
node "$HERE/fake-supabase.mjs" > "$HERE/.fake.log" 2>&1 & PIDS="$!"
eval "$(node "$HERE/fake-supabase.mjs" keys)"

# Build dédié : les variables NEXT_PUBLIC_* sont figées au build.
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" SUPABASE_SERVICE_ROLE_KEY="$SERVICE"
(cd "$WEB" && npx next build > "$HERE/.build.log" 2>&1) || { tail -30 "$HERE/.build.log"; exit 1; }
if curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1; then echo "Le port $PORT est déjà pris : arrêter le serveur qui y tourne." >&2; exit 1; fi
# Lancé par node directement : le PID est celui du serveur, pas d'un lanceur
# qui laisserait le serveur tourner après le test.
(cd "$WEB" && exec node node_modules/next/dist/bin/next start --port "$PORT" > "$HERE/.web.log" 2>&1) & PIDS="$PIDS $!"
for _ in $(seq 1 60); do curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1 && break; sleep 0.5; done

node "$HERE/scenario.mjs"
