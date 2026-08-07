#!/usr/bin/env python3
"""
Transcrit un gabarit d'e-mail en module TypeScript pour la fonction edge.

    python3 scripts/build-email-template.py

Pourquoi une génération plutôt qu'un copier-coller : le gabarit est
relu, corrigé et testé dans `marketing/emails/`. S'il en existait une
seconde copie éditable à la main dans la fonction edge, les deux
divergeraient — et la version qui part réellement chez les gens serait
celle que personne ne regarde.

Pourquoi pas une lecture du fichier à l'exécution : une fonction edge ne
déploie de façon garantie que son propre code. Un fichier lu au moment
de l'envoi est une dépendance qui peut manquer en production sans
prévenir, et l'échec se produirait alors sur un envoi réel.

Le HTML n'est pas modifié, seulement échappé pour tenir dans un gabarit
littéral JavaScript.
"""
import pathlib
import re

RACINE = pathlib.Path(__file__).resolve().parent.parent
SOURCE = RACINE / 'marketing' / 'emails' / 'presentation.html'
CIBLE = RACINE / 'supabase' / 'functions' / '_shared' / 'emailPresentation.ts'

html = SOURCE.read_text()

# Les commentaires HTML expliquent des choix de conception aux personnes
# qui éditent le gabarit. Ils n'ont rien à faire dans le message envoyé :
# ils gonflent le poids, et Gmail tronque au-delà de 102 Ko — en coupant
# le pied de page, donc le lien de désinscription.
html_envoye = re.sub(r'<!--(?!\[if )(?:(?!-->).)*?-->', '', html, flags=re.S)
html_envoye = re.sub(r'\n{3,}', '\n\n', html_envoye)

# Seuls trois caractères sont dangereux dans un gabarit littéral.
echappe = (html_envoye.replace('\\', '\\\\')
                      .replace('`', '\\`')
                      .replace('${', '\\${'))

variables = sorted(set(re.findall(r'\{\{(\w+)\}\}', html_envoye)))

CIBLE.parent.mkdir(parents=True, exist_ok=True)
CIBLE.write_text(f'''// Généré par scripts/build-email-template.py — NE PAS ÉDITER À LA MAIN.
// Source : marketing/emails/presentation.html
//
// Rejouer le script après toute modification du gabarit, sinon c'est
// l'ancienne version qui part chez les destinataires.

/** Variables attendues par le gabarit, dans l'ordre alphabétique. */
export const VARIABLES_PRESENTATION = {variables!r} as const

export const HTML_PRESENTATION = `{echappe}`
'''.replace("'", '"', 0))

print(f'{CIBLE.relative_to(RACINE)}')
print(f'  {len(html):>6} caractères en source')
print(f'  {len(html_envoye):>6} après retrait des commentaires '
      f'({100 - 100 * len(html_envoye) // len(html)} % de moins)')
print(f'  variables : {", ".join(variables)}')
