# Tiroir V4.0 — chantier isolé

Point de départ de la V4.0 : le Tiroir collaboratif, le prêt d'objets et leur
circulation (métaphore du **trousseau de clés** et de la **serrure**).

Source produit (Notion — les pages y portent encore le nom « V3 ») :
- [TIROIR V3](https://app.notion.com/p/3e15ccb8cef1817a90f1e4dc6ec67ff6)
- [Vision long terme — Tiroir collaboratif mobile V3+](https://app.notion.com/p/3905ccb8cef181d09288e19eff228d56)

## Règle d'or : rien ici ne touche la prod

Le web (`web/`) et l'app (`mobile/`) vivent dans ce même dépôt et partagent la
même base Supabase. Ce dossier est volontairement **hors de leur chemin** :

| Ce qui est ici | Pourquoi c'est sans effet sur le web et l'app |
| --- | --- |
| `docs/` | Documentation seule. |
| `supabase/drafts/*.sql` | Brouillons **non appliqués** : `supabase db push` ne lit que `supabase/migrations/`. |
| `domain/*.ts` | Logique métier pure, sans dépendance. Ni `web/` ni `mobile/` ne l'importent. |
| `torix/*.ts` | Ce que Torix sait de la V4.0 : fiches sans modèle. Ni `web/` ni `mobile/` ne l'importent. |

Tant que la V4.0 est en chantier :
1. Ne rien importer de `v4/` depuis `web/` ou `mobile/`, et inversement.
2. Ne rien déposer dans `supabase/migrations/` : un brouillon n'y entre qu'une
   fois rejoué et validé sur le **Supabase de preprod** (voir
   `preprod/RUNBOOK-supabase-preprod.md`, et vérifier le `link` avant tout `db push`).
3. Chaque étape qui touche le schéma partagé suit le plan de
   `docs/migration-tiroir-partage.md` (additif d'abord, bascule ensuite).

## Contenu

```
v4/
├── README.md
├── docs/
│   ├── vision.md                         # la vision V4.0, résumée depuis Notion
│   ├── migration-tiroir-partage.md     # ce qui bloque en V2, et le plan par phases
│   └── suggestions.md                    # suggestions sur une collection partagée + protocole de test
├── supabase/
│   ├── drafts/
│   │   ├── 0001_drawer_members.sql       # trousseau, serrure, invitations, lecture dédiée
│   │   ├── 0002_object_loans.sql         # le prêt comme objet de première classe
│   │   └── 0003_collection_suggestions.sql  # idées et suggestions d'une collection partagée
│   └── tests/                            # 45 tests 0001 + 42 tests 0003 (./run.sh URL_BASE_JETABLE)
├── e2e/suggestions/                      # banc e2e local des suggestions (Playwright)
├── domain/
│   ├── serrure.ts                        # niveaux de serrure, rôles, droits
│   ├── pret.ts                           # cycle de vie d'un prêt
│   └── *.test.ts
└── torix/
    ├── knowledge.ts                      # ce que Torix sait de la V4.0 (fiches, registre, source)
    └── knowledge.test.ts                 # les fiches comparées à domain/, aux brouillons et aux docs
```

## Torix et la V4.0

`torix/knowledge.ts` est le pendant, pour la V4.0, des fiches de
`web/components/torix/knowledge.ts` : réponses sans modèle, chacune avec
son registre (fait, estimation, principe) et sa source dans `v4/`. Il reste
ici tant que la V4.0 n'est pas fusionnée (pas d'import entre `v4/` et
`web/`), et rejoindra alors le Torix Lab, derrière `requireTorixOwnerPage`.

**Tout changement de `domain/`, d'un brouillon SQL ou d'une doc de décision
doit mettre ces fiches à jour** : `npm test` les compare au code et casse
sinon.

## Lancer les tests

Les règles ne demandent rien à installer (Node 22 lit le TypeScript nativement) ;
les brouillons SQL demandent `psql` et une base Postgres vide et jetable :

```bash
cd v4 && npm test                                        # règles (TypeScript)
./supabase/tests/run.sh "postgresql://…/base_jetable"    # brouillons SQL
```
