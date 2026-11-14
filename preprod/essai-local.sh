#!/usr/bin/env bash
# Tester l'essai sans compte (/essai) depuis un téléphone, sur le réseau
# local, avec le Supabase de PREPROD. À lancer sur le Mac, depuis le dépôt.
#
#   ./preprod/essai-local.sh base        # joue le brouillon SQL sur la preprod
#   ./preprod/essai-local.sh fonctions   # déploie trial-estimate et trial-cleanup
#   ./preprod/essai-local.sh site        # lance le site, visible du téléphone
#
# Chaque commande refuse de s'exécuter si elle vise la PROD (référence du
# projet de prod ci-dessous) : la preprod est un autre projet Supabase.
#
# Variables attendues :
#   web/.env.local     NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#                      SUPABASE_SERVICE_ROLE_KEY — celles du projet de preprod
#                      (les mêmes que preprod/tiroir/.env.preprod)
#   PREPROD_DB_URL     pour « base » : chaîne de connexion Postgres de la preprod
#                      (Supabase › Project Settings › Database › Connection string)
set -euo pipefail
PROD_REF="jsduaelevpwflvwhhhvx"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/web/.env.local"
PORT="${PORT:-3000}"

stop() { echo "✗ $*" >&2; exit 1; }
not_prod() { case "$1" in *"$PROD_REF"*) stop "Ceci vise la PROD ($PROD_REF). Rien n'a été fait." ;; esac; }

env_value() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/[[:space:]]*#.*$//' -e 's/^"//' -e 's/"$//'; }

preprod_ref() {
  [ -f "$ENV_FILE" ] || stop "web/.env.local manquant : y copier les trois variables Supabase de preprod/tiroir/.env.preprod."
  local url; url="$(env_value NEXT_PUBLIC_SUPABASE_URL)"
  [ -n "$url" ] || stop "NEXT_PUBLIC_SUPABASE_URL est vide dans web/.env.local."
  not_prod "$url"
  [ -n "$(env_value NEXT_PUBLIC_SUPABASE_ANON_KEY)" ] || stop "NEXT_PUBLIC_SUPABASE_ANON_KEY est vide dans web/.env.local."
  [ -n "$(env_value SUPABASE_SERVICE_ROLE_KEY)" ] || stop "SUPABASE_SERVICE_ROLE_KEY est vide dans web/.env.local."
  echo "$url" | sed -E 's#^https?://([^.]+)\..*#\1#'
}

case "${1:-}" in
  base)
    : "${PREPROD_DB_URL:?PREPROD_DB_URL requis : chaîne de connexion Postgres de la PREPROD}"
    not_prod "$PREPROD_DB_URL"
    ref="$(preprod_ref)"
    case "$PREPROD_DB_URL" in *"$ref"*) ;; *) stop "PREPROD_DB_URL ne désigne pas le projet de web/.env.local ($ref)." ;; esac
    psql "$PREPROD_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/drafts/essai_sans_compte.sql"
    psql "$PREPROD_DB_URL" -At -c "select 'essais ouverts : ' || trial_enabled || ', plafond du jour : ' || trial_daily_cap || ', par IP : ' || trial_per_ip_per_day from public.app_settings where id = 1"
    echo "✓ Brouillon joué sur la preprod ($ref). Rejouable sans effet."
    ;;
  fonctions)
    ref="$(preprod_ref)"
    (cd "$ROOT" && supabase functions deploy trial-estimate trial-cleanup --project-ref "$ref")
    echo "Secrets de la preprod (ANTHROPIC_API_KEY doit y figurer) :"
    (cd "$ROOT" && supabase secrets list --project-ref "$ref") || true
    echo "S'il manque : supabase secrets set --project-ref $ref ANTHROPIC_API_KEY=<clé de preprod>"
    ;;
  site)
    ref="$(preprod_ref)"
    ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)"
    echo "Supabase : preprod ($ref)"
    echo "À ouvrir sur l'iPhone (même Wi-Fi) :  http://${ip:-<IP-du-Mac>}:$PORT/essai"
    cd "$ROOT/web"
    [ -d node_modules ] || npm install --legacy-peer-deps
    exec npx next dev -H 0.0.0.0 -p "$PORT"
    ;;
  *)
    sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
