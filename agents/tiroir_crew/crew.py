"""
Orchestrateur principal — assemble agents et tâches en un Crew.
"""

from datetime import datetime
from crewai import Crew, Task, Process
from .agents import make_alice, make_bob, make_sofia


def run_mission(mission: str, agent_name: str = "bob") -> str:
    """
    Lance une mission pour un agent spécifique.

    Args:
        mission : description de la tâche à accomplir
        agent_name : "alice", "bob" ou "sofia"

    Returns:
        Résultat de l'agent sous forme de texte
    """
    agents_map = {
        "alice": make_alice,
        "bob": make_bob,
        "sofia": make_sofia,
    }

    if agent_name not in agents_map:
        return f"Agent inconnu : {agent_name}. Choisir parmi : alice, bob, sofia"

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
