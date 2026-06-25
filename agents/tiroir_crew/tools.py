"""
Outils partagés entre les agents Tiroir.
Chaque outil donne accès à une capacité concrète : lire/écrire des fichiers,
exécuter des commandes shell dans le projet, lire la roadmap, etc.
"""

import os
import subprocess
from pathlib import Path
from crewai.tools import tool

PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", "/Users/clementougier/TIROIR-app-V2"))
MOBILE_ROOT = PROJECT_ROOT / "mobile"
AGENTS_ROOT = PROJECT_ROOT / "agents"


@tool("Lire un fichier du projet")
def read_file(path: str) -> str:
    """Lit le contenu d'un fichier du projet Tiroir.
    Le chemin est relatif à la racine du projet (ex: mobile/src/lib/supabase.ts)."""
    full_path = PROJECT_ROOT / path
    if not full_path.exists():
        return f"ERREUR : fichier introuvable — {full_path}"
    try:
        return full_path.read_text(encoding="utf-8")
    except Exception as e:
        return f"ERREUR lecture : {e}"


@tool("Écrire ou modifier un fichier du projet")
def write_file(path: str, content: str = "") -> str:
    """Écrit du contenu dans un fichier du projet.
    Le chemin est relatif à la racine du projet.
    Crée les dossiers intermédiaires si nécessaire."""
    full_path = PROJECT_ROOT / path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        full_path.write_text(content, encoding="utf-8")
        return f"OK : {path} écrit ({len(content)} caractères)"
    except Exception as e:
        return f"ERREUR écriture : {e}"


@tool("Lister les fichiers d'un dossier")
def list_files(directory: str) -> str:
    """Liste les fichiers dans un dossier du projet (non récursif).
    Chemin relatif à la racine du projet."""
    full_path = PROJECT_ROOT / directory
    if not full_path.exists():
        return f"ERREUR : dossier introuvable — {full_path}"
    files = sorted(full_path.iterdir())
    return "\n".join(f.name + ("/" if f.is_dir() else "") for f in files)


@tool("Exécuter une commande shell dans le projet mobile")
def run_shell(command: str) -> str:
    """Exécute une commande shell dans le dossier mobile/.
    Utilise uniquement des commandes sûres : npx tsc --noEmit, yarn, etc.
    NE PAS utiliser pour des commandes destructives (rm -rf, git push --force…)."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=str(MOBILE_ROOT),
            capture_output=True,
            text=True,
            timeout=120,
        )
        output = result.stdout + result.stderr
        return output[:4000] if len(output) > 4000 else output or "(aucune sortie)"
    except subprocess.TimeoutExpired:
        return "ERREUR : commande trop longue (timeout 120s)"
    except Exception as e:
        return f"ERREUR shell : {e}"


@tool("Lire la roadmap du projet")
def read_roadmap() -> str:
    """Retourne la roadmap complète du projet Tiroir V2."""
    roadmap_path = AGENTS_ROOT / "ROADMAP.md"
    if roadmap_path.exists():
        return roadmap_path.read_text(encoding="utf-8")
    return "Roadmap introuvable — créer agents/ROADMAP.md"


@tool("Écrire un rapport dans outputs/")
def write_report(filename: str = "rapport.md", content: str = "") -> str:
    """Sauvegarde un rapport texte dans agents/outputs/.
    filename : nom du fichier (ex: plan_chat_turn.md)
    content  : contenu complet du rapport en markdown"""
    output_path = AGENTS_ROOT / "outputs" / (filename or "rapport.md")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content or "(rapport vide)", encoding="utf-8")
    return f"Rapport sauvegardé : agents/outputs/{filename}"
