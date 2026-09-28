#!/usr/bin/env bash
# Banc e2e des suggestions, 100 % local : Postgres jetable + PostgREST + faux
# Supabase (auth, stockage) + web en production + Playwright.
#
#   ./run.sh "postgresql://postgres@localhost:5432/tiroir_e2e" /chemin/vers/postgrest
#
# La base doit être VIDE et jetable (même règle que ../../supabase/tests).
# Joue deux phases : « before » sans les brouillons 0003-0004 (rien ne doit
# changer), puis « after » avec. Captures dans ./shots. Ne touche ni prod ni preprod.
set -euo pipefail
DB="${1:?Usage : ./run.sh URL_BASE_VIDE CHEMIN_POSTGREST}"
PGRST="${2:?Chemin du binaire postgrest (https://github.com/PostgREST/postgrest/releases)}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TESTS="$HERE/../../supabase/tests"
WEB="$HERE/../../../web"
export SHOTS="$HERE/shots" E2E_DB="$DB"; mkdir -p "$SHOTS"

psql "$DB" -q -f "$TESTS/stub.sql" >/dev/null 2>&1 || true
psql "$DB" -q -f <(sed '/^CREATE ROLE service_role;/d' "$TESTS/stub_0003.sql") -v ON_ERROR_STOP=1
psql "$DB" -q -c "DO \$\$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$" >/dev/null
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/setup.sql"

# PostgREST se connecte en authenticator, sur la même base.
PGRST_DB_URI="$(node -e 'const u=new URL(process.argv[1]); u.username="authenticator"; u.password=""; console.log(u.toString())' "$DB")"
cat > "$HERE/.pgrst.conf" <<CONF
db-uri = "$PGRST_DB_URI"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "test-secret-test-secret-test-secret-00"
server-port = 3001
CONF

cleanup() { kill ${PIDS:-} 2>/dev/null || true; }
trap cleanup EXIT
"$PGRST" "$HERE/.pgrst.conf" > "$HERE/.pgrst.log" 2>&1 & PIDS="$!"
node "$HERE/fake-supabase.mjs" > "$HERE/.fake.log" 2>&1 & PIDS="$PIDS $!"
eval "$(node "$HERE/fake-supabase.mjs" keys)"

# Build dédié : les variables NEXT_PUBLIC_* sont figées au build.
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" SUPABASE_SERVICE_ROLE_KEY="$SERVICE"
(cd "$WEB" && npx next build >/dev/null)
(cd "$WEB" && exec npx next start -p 3000 > "$HERE/.next.log" 2>&1) & PIDS="$PIDS $!"
sleep 6

node "$HERE/scenario.mjs" before
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/../../supabase/drafts/0003_collection_suggestions.sql" 2>&1 | grep -v NOTICE || true
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/../../supabase/drafts/0004_share_link_suggestions.sql" 2>&1 | grep -v NOTICE || true
psql "$DB" -q -c "NOTIFY pgrst, 'reload schema'"; sleep 1
node "$HERE/scenario.mjs" after
