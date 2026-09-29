# Tiroir V5 — chantier isolé

La V5 vient après la V4.0 (Tiroir collaboratif et prêt, voir `v4/`). Elle
n'est **pas encore définie** : ni le dépôt ni Notion ne la décrivent. Ce
dossier lui donne une place et une mémoire, pour que chaque décision soit
consignée au même endroit.

## Règle d'or : rien ici ne touche la prod

Mêmes règles que `v4/README.md` :
1. Ne rien importer de `v5/` depuis `web/`, `mobile/` ou `v4/`, et inversement.
2. Ne rien déposer dans `supabase/migrations/` sans validation sur le
   **Supabase de preprod** (`preprod/RUNBOOK-supabase-preprod.md`).

## Contenu

```
v5/
├── README.md
├── docs/
│   └── vision.md            # décisions et questions ouvertes (vide pour l'instant)
└── torix/
    ├── knowledge.ts         # ce que Torix sait de la V5 (fiches, registre, source)
    └── knowledge.test.ts    # les fiches comparées à docs/vision.md
```

## Torix et la V5

Pendant de `v4/torix/knowledge.ts` : réponses sans modèle, avec registre et
source. Tant que `docs/vision.md` ne consigne aucune décision, Torix répond
que la V5 reste à définir, et n'invente rien.

**Chaque décision ajoutée à `docs/vision.md` doit entrer dans les fiches** :
le test casse dès que la section « Décisions » n'est plus vide.

```bash
cd v5 && npm test
```
