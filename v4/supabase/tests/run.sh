#!/usr/bin/env bash
# Rejoue les brouillons V4.0 sur une base Postgres VIDE et jetable, puis
# lance les tests. Jamais sur la prod ni la preprod : stub.sql y créerait
# de fausses tables.
#
#   ./run.sh "postgresql://postgres@localhost:5432/tiroir_v4_test"
set -euo pipefail
DB="${1:?Usage : ./run.sh URL_DE_BASE_POSTGRES_VIDE}"
HERE="$(cd "$(dirname "$0")" && pwd)"

psql "$DB" -q -f "$HERE/stub.sql" >/dev/null 2>&1 || true   # rôles déjà présents : sans gravité
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/../drafts/0001_drawer_members.sql" 2>&1 | grep -v NOTICE || true
psql "$DB" -q -f "$HERE/0001_drawer_members.test.sql" | tee /dev/stderr | grep -q "| *0$"
