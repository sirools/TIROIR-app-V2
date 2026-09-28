#!/usr/bin/env bash
# Met à jour la preprod Tiroir DEPUIS LE NAS, sans le Mac : utilisable depuis
# une app SSH sur iPhone (Termius, Blink…), connecté au Wi-Fi de la maison.
#
# Usage (sur le NAS, dans le dossier du stack) :
#   ./nas-update.sh                               # branche main
#   ./nas-update.sh feature/v4-suggestions-web    # n'importe quelle branche
#
# Ce que fait le script :
#   1. garde un clone du repo dans ./src (sauvegarde locale du code sur le NAS) ;
#   2. se place sur la branche demandée, à jour avec GitHub ;
#   3. recopie web/ dans tiroir/app/ (le contexte de build, comme deploy.sh) ;
#   4. reconstruit et redémarre le conteneur Next.js avec tiroir/.env.preprod.
#
# Installation unique (depuis le Mac) : voir preprod/README.md, section
# « Mettre à jour sans le Mac ». Le jeton GitHub est lu dans ./.github-token
# (lecture seule, jamais affiché, jamais commité).
set -euo pipefail

BRANCH="${1:-main}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/src"
REPO_URL="https://github.com/sirools/TIROIR-app-V2.git"
TOKEN_FILE="$HERE/.github-token"

[ -f "$HERE/tiroir/.env.preprod" ] || { echo "!! tiroir/.env.preprod manquant : lancer une fois ./deploy.sh depuis le Mac."; exit 1; }
[ -f "$TOKEN_FILE" ] || { echo "!! $TOKEN_FILE manquant (jeton GitHub en lecture seule, voir preprod/README.md)."; exit 1; }

DOCKER="docker"; docker ps >/dev/null 2>&1 || DOCKER="sudo docker"

# git natif s'il existe, sinon via un conteneur (UGOS ne fournit pas toujours git).
AUTH="Authorization: Basic $(printf 'x-access-token:%s' "$(tr -d '[:space:]' < "$TOKEN_FILE")" | base64 | tr -d '\n')"
git_() {
  if command -v git >/dev/null 2>&1; then
    git -c "http.extraHeader=$AUTH" "$@"
  else
    # Même utilisateur que le NAS : les fichiers restent modifiables sans sudo.
    $DOCKER run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$HERE:$HERE" -w "$PWD" \
      alpine/git -c safe.directory='*' -c "http.extraHeader=$AUTH" "$@"
  fi
}

cd "$HERE"
echo "==> Code : $BRANCH"
if [ ! -d "$SRC/.git" ]; then
  git_ clone --quiet "$REPO_URL" "$SRC"
fi
cd "$SRC"
git_ fetch --quiet --prune origin
git_ checkout --quiet -B "$BRANCH" "origin/$BRANCH"
git_ reset --quiet --hard "origin/$BRANCH"
echo "    $(git_ log -1 --format='%h %cs %s')"
cd "$HERE"

echo "==> Contexte de build (web/ -> tiroir/app/)…"
rm -rf "$HERE/tiroir/app"
mkdir -p "$HERE/tiroir/app"
( cd "$SRC/web" && tar --exclude node_modules --exclude .next --exclude .env --exclude .env.local -cf - . ) \
  | ( cd "$HERE/tiroir/app" && tar -xf - )

echo "==> Build & redémarrage de la preprod…"
set -a; . "$HERE/tiroir/.env.preprod"; set +a
$DOCKER compose up -d --build tiroir 2>/dev/null || $DOCKER compose up -d --build

echo
echo "✅ Preprod à jour sur $BRANCH : http://$(hostname -I 2>/dev/null | awk '{print $1}'):8151/"
