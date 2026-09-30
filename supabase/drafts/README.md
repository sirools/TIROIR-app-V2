# Brouillons de migrations (Tiroir en prod)

Migrations écrites et testées, **pas encore appliquées** à la prod. Une fois
appliquées, elles passent dans `supabase/migrations/` sous le nom
`<version>_<nom>.sql`, avec la version que la base a enregistrée (voir
`supabase/migrations/README.md`).

| Brouillon | Pour quoi | Tests |
| --- | --- | --- |
| `ai_credits.sql` | Crédits IA, marche 1 : solde et journal (`strategie/offres.md`) | `tests/run.sh` (20 tests) |
| `ai_credits_spend.sql` | Crédits IA, marche 2 : les analyses puisent dans le quota, puis dans les crédits | `tests/run.sh` (11 tests) |

## Tester

Sur une base Postgres **vide et jetable** (jamais la prod ni la preprod) :

```bash
./tests/run.sh "postgresql://postgres@localhost:5432/tiroir_drafts_test"
```

## Appliquer en prod, dans l'ordre

`ai_credits.sql`, puis `ai_credits_spend.sql`, puis redéployer les
fonctions `detect-scene`, `describe-object` et `chat-turn`. Les fonctions
fonctionnent aussi AVANT le SQL : elles retombent sur l'ancien quota
(`_shared/aiSpend.ts`).

## Appliquer `ai_credits.sql` en prod

1. Supabase → SQL Editor : coller le fichier, exécuter. Il est additif et
   peut être rejoué sans effet.
2. Relire la version enregistrée, puis déplacer le fichier dans
   `supabase/migrations/<version>_ai_credits.sql`.
