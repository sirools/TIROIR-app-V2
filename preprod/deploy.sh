#!/usr/bin/env bash
# Déploiement du stack de preprod Tiroir sur le NAS UGREEN (UGOS Pro + Docker) via SSH.
#
# Usage :
#   ./deploy.sh <user>@<ip_du_nas> [port_ssh] [volume]
# Exemple :
#   ./deploy.sh clementougier@192.168.1.23 22 volume1
#
# Prérequis NAS : volume créé, Docker installé, SSH activé, clé publique installée.
# Ne stocke aucun secret : .env.preprod est copié tel quel, jamais affiché.
set -euo pipefail

TARGET="${1:?usage: ./deploy.sh user@ip [port] [volume]}"
PORT="${2:-22}"
VOLUME="${3:-volume1}"
REMOTE_DIR="/${VOLUME}/docker/tiroir-preprod"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
KEY="$HERE/ssh/tiroir_preprod_ed25519"
SSH_OPTS="-p $PORT"
[ -f "$KEY" ] && SSH_OPTS="-i $KEY -p $PORT"

echo "==> Cible       : $TARGET (port $PORT)"
echo "==> Dossier NAS : $REMOTE_DIR"

# 1. Vérif .env.preprod présent
if [ ! -f "$HERE/tiroir/.env.preprod" ]; then
  echo "!! Manquant : preprod/tiroir/.env.preprod (copier .env.preprod.example et remplir)."; exit 1
fi

# 2. Synchroniser le code source de l'app Next.js dans le contexte de build
echo "==> Préparation du contexte de build (web/ -> tiroir/app/)…"
rsync -a --delete \
  --exclude 'node_modules' --exclude '.next' --exclude '.env' \
  --exclude '.env.local' --exclude 'tsconfig.tsbuildinfo' --exclude '.DS_Store' \
  "$REPO/web/" "$HERE/tiroir/app/"

# 3. Vérifier Docker sur le NAS
echo "==> Vérification de Docker…"
ssh $SSH_OPTS "$TARGET" 'docker --version || sudo docker --version' \
  || { echo "!! Docker introuvable : installe-le via le Centre d'applications UGOS."; exit 1; }

# 4. Copier le stack sur le NAS
echo "==> Copie du stack (rsync)…"
ssh $SSH_OPTS "$TARGET" "mkdir -p '$REMOTE_DIR'"
# .sauvegarde.env n'existe que sur le NAS : exclu, donc jamais effacé par
# --delete (sans --delete-excluded, rsync ne touche pas aux exclus).
rsync -az --delete -e "ssh $SSH_OPTS" --exclude '.DS_Store' --exclude '.sauvegarde.env' \
  "$HERE/docker-compose.yml" "$HERE/web" "$HERE/nginx" \
  "$HERE/filebrowser" "$HERE/tiroir" "$HERE/nas-update.sh" "$HERE/sauvegarde" \
  "$TARGET:$REMOTE_DIR/"

# 5. Build + up (les NEXT_PUBLIC_* du build viennent de .env.preprod)
echo "==> Build & démarrage…"
ssh $SSH_OPTS "$TARGET" "cd '$REMOTE_DIR' && set -a && . ./tiroir/.env.preprod && set +a && \
  (docker compose up -d --build || sudo docker compose up -d --build)"

IP="${TARGET#*@}"
echo
echo "✅ Terminé."
echo "   Hello world   : http://$IP:8080/"
echo "   Drive         : http://$IP:8081/   (login initial admin/admin — À CHANGER)"
echo "   Preprod Tiroir: http://$IP:8151/"
