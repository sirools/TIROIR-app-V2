#!/usr/bin/env bash
# Rejoue essai_sans_compte.sql sur une base Postgres VIDE et jetable (pas la
# même que run.sh ni run_locale.sh), puis lance les tests. Jamais sur la
# prod ni la preprod.
#
#   ./run_essai.sh "postgresql://postgres@localhost:5432/tiroir_essai_test"
set -euo pipefail
DB="${1:?Usage : ./run_essai.sh URL_DE_BASE_POSTGRES_VIDE}"
HERE="$(cd "$(dirname "$0")" && pwd)"
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/stub_essai.sql" >/dev/null
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/../essai_sans_compte.sql" >/dev/null
psql "$DB" -q -f "$HERE/essai_sans_compte.test.sql" | tee /dev/stderr | tail -3 | grep -qE "^ +0$"
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/../essai_sans_compte.sql" >/dev/null 2>&1
echo "✓ essai_sans_compte : tous les tests passent, rejouable"
