# War room growth J+7 — Tiroir

Objectif : passer des premiers signaux de lancement à une boucle d'apprentissage quotidienne.

Point de départ J+1 :
- 83 visiteurs uniques
- 133 visites sur 24h
- 214 visites sur 7j / 30j
- 12 comptes créés
- 292 objets créés
- 10 comptes avec au moins 1 objet, soit 83,3% d'activation

Diagnostic court : l'activation est forte. Le levier prioritaire est donc le trafic qualifié, puis la compréhension des sources qui créent des comptes activés.

## Agents disponibles

### Mina — Growth
Mission : acquisition, contenu, communautés, relances, calendrier d'actions.

Exemples :
```bash
cd agents
python main.py --agent mina --mission "Prépare 5 posts LinkedIn et 5 messages X pour viser 30 nouveaux comptes cette semaine"
```

### Omar — Data
Mission : métriques, dashboard, tracking, activation, sources de trafic.

Exemples :
```bash
cd agents
python main.py --agent omar --mission "Analyse le dashboard et propose les métriques à ajouter pour suivre source -> compte créé -> premier objet"
```

### Bob — Produit
Mission : boucles produit rapides : invitation, partage, referral, CTA après activation.

Exemples :
```bash
cd agents
python main.py --agent bob --mission "Explore les boucles de partage existantes et propose la plus rapide à implémenter"
```

## Commande war room

Lance Mina, Omar et Bob en parallèle :

```bash
cd agents
python main.py --growth
```

La sortie attendue :
- Mina : plan d'acquisition et assets prêts à publier
- Omar : tracking minimal à ajouter ou analyser
- Bob : petites boucles produit priorisées

## Rituel quotidien

Chaque matin :
- relever visiteurs, comptes créés, comptes avec >=1 objet, objets créés
- identifier le canal qui a amené le plus de comptes activés
- choisir 3 actions du jour maximum

Chaque soir :
- noter ce qui a été publié, où, avec quel CTA
- comparer vues / clics / comptes / activation
- garder uniquement les angles qui créent des comptes activés

## Objectifs J+7

- 100 comptes créés
- 60 comptes avec au moins 1 objet
- 1 canal principal identifié
- 1 boucle produit de partage ou referral en ligne
- 1 dashboard source -> compte -> activation lisible

## Backlog immédiat

1. Publier un post build-in-public avec les chiffres J+1.
2. Contacter les 12 premiers utilisateurs pour feedback et referral.
3. Ajouter des UTM à chaque lien publié.
4. Mesurer source, inscription et premier objet.
5. Prioriser une boucle produit : partage existant, invitation ou CTA après troisième objet.
