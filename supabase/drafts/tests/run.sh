#!/usr/bin/env bash
# Rejoue les brouillons sur une base Postgres VIDE et jetable, puis lance
# les tests. Jamais sur la prod ni la preprod : stub.sql y créerait de
# fausses tables.
#
#   ./run.sh "postgresql://postgres@localhost:5432/tiroir_drafts_test"
set -euo pipefail
DB="${1:?Usage : ./run.sh URL_DE_BASE_POSTGRES_VIDE}"
HERE="$(cd "$(dirname "$0")" && pwd)"
psql "$DB" -q -f "$HERE/stub.sql" >/dev/null 2>&1 || true
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/../ai_credits.sql"
psql "$DB" -q -f "$HERE/ai_credits.test.sql" | tee /dev/stderr | tail -3 | grep -qE "^ +0$"
echo "✓ ai_credits : tous les tests passent"
