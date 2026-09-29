#!/usr/bin/env bash
# Vérifie qu'une sauvegarde se déchiffre et se relit — SUR LE MAC, là où
# est la clé privée. Rien n'est écrit en clair : le déchiffrement passe
# directement dans pg_restore, qui ne fait que lister le contenu.
#
# Usage :
#   ./verifier-sauvegarde.sh tiroir-prod-AAAAMMJJ-HHMMSSZ.dump.age ~/chemin/cle-privee.txt
#
# Prérequis sur le Mac : brew install age libpq  (pg_restore est dans libpq).
set -euo pipefail

FILE="${1:?Usage : $0 FICHIER.dump.age FICHIER_CLE_PRIVEE}"
KEY="${2:?Usage : $0 FICHIER.dump.age FICHIER_CLE_PRIVEE}"
[ -f "$FILE" ] || { echo "!! $FILE introuvable"; exit 1; }
[ -f "$KEY" ] || { echo "!! $KEY introuvable"; exit 1; }

LIST="$(age -d -i "$KEY" "$FILE" | pg_restore --list)"
tables="$(echo "$LIST" | grep -c ' TABLE DATA ' || true)"
echo "$LIST" | grep ' TABLE DATA public ' | awk '{print "  " $(NF-1)}' | head -40
echo "✓ Sauvegarde lisible : $tables tables avec données."
