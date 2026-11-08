#!/usr/bin/env bash
# Rejoue profiles_locale.sql sur une base Postgres VIDE et jetable (pas la
# même que run.sh : les deux créent leur propre auth.users), puis lance
# les tests. Jamais sur la prod ni la preprod.
#
#   ./run_locale.sh "postgresql://postgres@localhost:5432/tiroir_locale_test"
set -euo pipefail
DB="${1:?Usage : ./run_locale.sh URL_DE_BASE_POSTGRES_VIDE}"
HERE="$(cd "$(dirname "$0")" && pwd)"
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/stub_locale.sql" >/dev/null
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/../profiles_locale.sql" >/dev/null
psql "$DB" -q -f "$HERE/profiles_locale.test.sql" | tee /dev/stderr | tail -3 | grep -qE "^ +0$"
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/../profiles_locale.sql" >/dev/null 2>&1
echo "✓ profiles_locale : tous les tests passent, rejouable"
