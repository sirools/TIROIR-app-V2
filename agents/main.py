#!/usr/bin/env python3
"""
Point d'entrée principal — interface PDG ↔ équipe Tiroir.

Usage :
  # Mission pour un agent unique
  python main.py --agent bob --mission "Implémenter l'écran d'édition d'objet (phase 1.3)"

  # Mission parallèle pour toute l'équipe
  python main.py --team

  # Mode interactif (poser une question à un agent)
  python main.py --chat alice
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Vérification clé API
if not os.getenv("ANTHROPIC_API_KEY"):
    print("❌ ANTHROPIC_API_KEY manquante dans agents/.env")
    print("   Copie .env.example en .env et ajoute ta clé Anthropic.")
    sys.exit(1)


def single_mission(agent: str, mission: str):
    from tiroir_crew.crew import run_mission

    print(f"\n{'='*60}")
    print(f"🚀 Mission confiée à {agent.capitalize()}")
    print(f"📋 {mission}")
    print(f"⏰ {datetime.now().strftime('%H:%M:%S')}")
    print(f"{'='*60}\n")

    result = run_mission(mission, agent)

    print(f"\n{'='*60}")
    print(f"✅ Résultat de {agent.capitalize()}")
    print(f"{'='*60}")
    print(result)

    # Sauvegarder le résultat
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    out = Path("outputs") / f"{ts}_{agent}_result.txt"
    out.parent.mkdir(exist_ok=True)
    out.write_text(f"Mission : {mission}\n\nRésultat :\n{result}")
    print(f"\n💾 Résultat sauvegardé dans {out}")


def team_mission():
    from tiroir_crew.crew import run_team_mission

    print("\n🏢 RÉUNION D'ÉQUIPE — Tiroir V2")
    print("Chaque agent reçoit sa mission de phase 1...\n")

    missions = {
        "alice": (
            "Prépare le code complet de l'Edge Function chat-turn. "
            "Elle doit : recevoir un draft_id, récupérer les images depuis Storage, "
            "appeler Claude Vision (claude-haiku-4-5-20251001) pour identifier l'objet, "
            "remplir proposed_data, passer le draft en statut 'pending'. "
            "Écris le fichier supabase/functions/chat-turn/index.ts complet et prêt à déployer. "
            "Documente les variables d'environnement nécessaires."
        ),
        "bob": (
            "Implémente l'écran d'édition d'objet (roadmap 1.3). "
            "L'écran doit permettre de modifier : titre, description, emplacement, collection. "
            "Il doit être accessible depuis la fiche objet (app/(app)/objects/[id].tsx). "
            "Utilise confirm_change_proposal ou une approche directe selon ce qui est faisable. "
            "Vérifie que TypeScript compile à la fin."
        ),
        "sofia": (
            "Fais un audit visuel complet de tous les écrans existants. "
            "Liste toutes les incohérences de spacing, radius, typographie et couleurs "
            "par rapport aux tokens définis dans mobile/src/components/ui/tokens.ts. "
            "Corrige les 3 incohérences les plus visibles. "
            "Rédige un rapport des corrections faites et de celles qui restent."
        ),
    }

    results = run_team_mission(missions)

    print("\n" + "="*60)
    print("📊 RAPPORTS DE L'ÉQUIPE")
    print("="*60)
    for name, result in results.items():
        print(f"\n👤 {name.capitalize()} :")
        print(result[:500] + "..." if len(result) > 500 else result)
        print()


def interactive_chat(agent: str):
    from tiroir_crew.crew import run_mission

    names = {"alice": "Alice", "bob": "Bob", "sofia": "Sofia"}
    name = names.get(agent, agent.capitalize())

    print(f"\n💬 Chat avec {name} — tape 'quit' pour terminer\n")

    while True:
        mission = input(f"PDG → {name} : ").strip()
        if mission.lower() in ("quit", "exit", "q"):
            print(f"À bientôt, {name} continue à travailler en arrière-plan.")
            break
        if not mission:
            continue

        print(f"\n⏳ {name} travaille...\n")
        result = run_mission(mission, agent)
        print(f"\n{name} → PDG :\n{result}\n")


def main():
    parser = argparse.ArgumentParser(description="Interface PDG — Équipe Tiroir V2")
    parser.add_argument("--agent", choices=["alice", "bob", "sofia"],
                        help="Nom de l'agent à solliciter")
    parser.add_argument("--mission", type=str,
                        help="Mission à confier à l'agent")
    parser.add_argument("--team", action="store_true",
                        help="Lancer une mission d'équipe (tous les agents en parallèle)")
    parser.add_argument("--chat", choices=["alice", "bob", "sofia"],
                        help="Mode interactif avec un agent")

    args = parser.parse_args()

    if args.team:
        team_mission()
    elif args.chat:
        interactive_chat(args.chat)
    elif args.agent and args.mission:
        single_mission(args.agent, args.mission)
    else:
        parser.print_help()
        print("\n📖 Exemples :")
        print('  python main.py --agent alice --mission "Déploie chat-turn"')
        print('  python main.py --agent bob --mission "Crée l\'écran d\'édition objet"')
        print('  python main.py --chat sofia')
        print('  python main.py --team')


if __name__ == "__main__":
    main()
