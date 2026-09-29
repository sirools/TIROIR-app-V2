#!/usr/bin/env bash
# Sauvegarde CHIFFRÉE de la base de PROD de Tiroir, depuis le NAS.
#
# Usage (sur le NAS, dans preprod/sauvegarde/) :
#   ./sauvegarde-base.sh
#
# Ce que fait le script :
#   1. exporte la base (pg_dump, format « custom ») ;
#   2. la chiffre AU VOL avec age, pour la clé publique du fondateur :
#      rien n'est jamais écrit en clair sur le disque ;
#   3. range le fichier dans DEST_DIR (idéalement un dossier chiffré du NAS)
#      et ne garde que les KEEP dernières sauvegardes.
#
# Le NAS n'a que la clé PUBLIQUE (age1…), qui sert à chiffrer. La clé
# PRIVÉE, qui déchiffre, n'est jamais sur le NAS : trousseau iCloud et
# papier. Même avec le contrôle du NAS, on ne peut pas lire les sauvegardes.
#
# Réglages lus dans ./.sauvegarde.env (droits 600, jamais commité) — voir
# .sauvegarde.env.exemple et README.md. Coût : 0 €, tout passe par Docker.
#
# Pour essayer sans Docker (Mac avec pg_dump et age installés) :
#   SANS_DOCKER=1 ./sauvegarde-base.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CONF="${SAUVEGARDE_CONF:-$HERE/.sauvegarde.env}"

die() { echo "!! $*" >&2; exit 1; }

[ -f "$CONF" ] || die "$CONF manquant : copier .sauvegarde.env.exemple, le remplir, puis chmod 600."
perms="$(stat -c %a "$CONF" 2>/dev/null || stat -f %Lp "$CONF")"
[ "$perms" = "600" ] || die "$CONF doit être en 600 (il contient l'accès à la base) : chmod 600 \"$CONF\"."

# Lecture ligne à ligne, SANS exécuter le fichier : une adresse ou un mot
# de passe peut contenir & ou $, que le shell interpréterait.
SUPABASE_DB_URL=""; AGE_RECIPIENT=""; DEST_DIR=""; KEEP=""; PG_IMAGE=""
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  case "$line" in ''|'#'*) continue ;; esac
  key="${line%%=*}"; val="${line#*=}"
  case "$val" in \"*\") val="${val:1:${#val}-2}" ;; \'*\') val="${val:1:${#val}-2}" ;; esac
  case "$key" in
    SUPABASE_DB_URL|AGE_RECIPIENT|DEST_DIR|KEEP|PG_IMAGE) printf -v "$key" '%s' "$val" ;;
    *) die "Réglage inconnu dans $CONF : $key" ;;
  esac
done < "$CONF"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquant dans $CONF}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT manquant dans $CONF}"
: "${DEST_DIR:?DEST_DIR manquant dans $CONF}"
KEEP="${KEEP:-30}"
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"

case "$AGE_RECIPIENT" in
  age1*) ;;
  AGE-SECRET-KEY-*) die "AGE_RECIPIENT contient la clé PRIVÉE. Mettre la clé publique (age1…) ; la privée ne va jamais sur le NAS." ;;
  *) die "AGE_RECIPIENT doit être une clé publique age (age1…)." ;;
esac
case "$KEEP" in ''|*[!0-9]*) die "KEEP doit être un nombre." ;; esac
[ "$KEEP" -ge 1 ] || die "KEEP doit valoir au moins 1."

mkdir -p "$DEST_DIR"
[ -w "$DEST_DIR" ] || die "$DEST_DIR n'est pas accessible en écriture."

STAMP="$(date -u +%Y%m%d-%H%M%SZ)"
OUT="$DEST_DIR/tiroir-prod-$STAMP.dump.age"
TMP="$OUT.partiel"
trap 'rm -f "$TMP"' EXIT
umask 077

echo "→ Export chiffré de la base de prod…"
# L'adresse de la base passe par l'environnement (-e DB_URL sans valeur),
# jamais par la ligne de commande : elle n'apparaît pas dans `ps`.
export DB_URL="$SUPABASE_DB_URL" AGE_RECIPIENT
if [ "${SANS_DOCKER:-0}" = "1" ]; then
  pg_dump "$DB_URL" --format=custom --no-owner --no-privileges | age -r "$AGE_RECIPIENT" > "$TMP"
else
  DOCKER="docker"; docker ps >/dev/null 2>&1 || DOCKER="sudo docker"
  $DOCKER run --rm -e DB_URL -e AGE_RECIPIENT "$PG_IMAGE" sh -c '
    set -eo pipefail
    apk add --no-cache -q age >/dev/null
    pg_dump "$DB_URL" --format=custom --no-owner --no-privileges | age -r "$AGE_RECIPIENT"
  ' > "$TMP"
fi
unset DB_URL

# Un fichier age commence par cet en-tête ; un export vide ou raté non.
size="$(wc -c < "$TMP" | tr -d ' ')"
head -c 21 "$TMP" | grep -q '^age-encryption.org/v1' || die "Le fichier produit n'est pas un fichier age : sauvegarde abandonnée."
[ "$size" -gt 1024 ] || die "Sauvegarde suspecte ($size octets) : abandonnée."

mv "$TMP" "$OUT"
trap - EXIT
echo "✓ $OUT ($(( size / 1024 )) Ko, chiffré)"

# Rotation : on garde les KEEP plus récentes.
old="$(ls -1t "$DEST_DIR"/tiroir-prod-*.dump.age 2>/dev/null | tail -n +"$((KEEP + 1))")"
if [ -n "$old" ]; then
  echo "$old" | while IFS= read -r f; do rm -f -- "$f"; done
  echo "✓ Anciennes sauvegardes retirées : $(echo "$old" | wc -l | tr -d ' ') (on en garde $KEEP)"
fi
