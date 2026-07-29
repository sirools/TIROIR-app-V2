"""
Orchestrateur principal — assemble agents et tâches en un Crew.
"""

from datetime import datetime
from crewai import Crew, Task, Process
from .agents import make_alice, make_bob, make_sofia, make_mina, make_omar


def run_mission(mission: str, agent_name: str = "bob") -> str:
    """
    Lance une mission pour un agent spécifique.

    Args:
        mission : description de la tâche à accomplir
        agent_name : "alice", "bob", "sofia", "mina" ou "omar"

    Returns:
        Résultat de l'agent sous forme de texte
    """
    agents_map = {
        "alice": make_alice,
        "bob": make_bob,
        "sofia": make_sofia,
        "mina": make_mina,
        "omar": make_omar,
    }

    if agent_name not in agents_map:
        return f"Agent inconnu : {agent_name}. Choisir parmi : alice, bob, sofia, mina, omar"

    agent = agents_map[agent_name]()

    task = Task(
        description=(
            f"{mission}\n\n"
            f"Date : {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
            "Instructions :\n"
            "1. Lis la roadmap (outil read_roadmap) pour contextualiser ton travail.\n"
            "2. Explore les fichiers concernés avant de modifier quoi que ce soit.\n"
            "3. Fais les modifications nécessaires fichier par fichier.\n"
            "4. Si tu modifies du code TypeScript, vérifie avec : npx tsc --noEmit\n"
            "5. Le rapport final est automatiquement sauvegardé — pas besoin d'appeler d'outil.\n"
            "6. Termine par un résumé clair : ce qui a été fait, ce qui reste, blocages éventuels."
        ),
        expected_output=(
            "Un rapport structuré contenant :\n"
            "- Ce qui a été accompli\n"
            "- Les fichiers modifiés et pourquoi\n"
            "- Ce qui reste à faire\n"
            "- Les questions ou blocages pour le PDG"
        ),
        agent=agent,
    )

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )

    result = crew.kickoff()
    return str(result)


def run_team_mission(missions: dict[str, str]) -> dict[str, str]:
    """
    Lance des missions en parallèle pour plusieurs agents.

    Args:
        missions : dict {"alice": "tâche Alice", "bob": "tâche Bob", ...}

    Returns:
        dict {"alice": résultat, "bob": résultat, ...}
    """
    from concurrent.futures import ThreadPoolExecutor

    def run_one(item):
        name, mission = item
        return name, run_mission(mission, name)

    with ThreadPoolExecutor(max_workers=3) as executor:
        results = dict(executor.map(run_one, missions.items()))

    return results


def run_growth_war_room() -> dict[str, str]:
    """
    Lance la war room J+7 : growth, data et produit en parallèle.
    """
    missions = {
        "mina": (
            "Prépare le plan growth J+7 de Tiroir à partir des chiffres actuels : "
            "83 visiteurs uniques, 133 visites 24h, 214 visites 7j/30j, 12 comptes créés, "
            "292 objets créés, 10 comptes avec au moins 1 objet. "
            "Livre des posts prêts à publier, messages de relance, canaux à tester, "
            "et un calendrier d'actions sur 7 jours."
        ),
        "omar": (
            "Analyse les métriques de lancement et le code du dashboard. "
            "Propose les découpages à ajouter pour comprendre les sources qui créent "
            "des comptes activés : source, campagne, device, pays, landing, inscription, "
            "premier objet, deuxième session. "
            "Livre un plan de tracking J+7 très simple et actionnable."
        ),
        "bob": (
            "Explore l'application mobile et identifie les petites boucles produit "
            "implémentables rapidement pour aider la croissance : partage, invitation, "
            "CTA après création du premier ou troisième objet, export partageable. "
            "Ne modifie pas le code. Priorise par impact, effort et risque."
        ),
    }
    return run_team_mission(missions)
