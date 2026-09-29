# Brouillons de migrations (Tiroir en prod)

Migrations écrites et testées, **pas encore appliquées** à la prod. Une fois
appliquées, elles passent dans `supabase/migrations/` sous le nom
`<version>_<nom>.sql`, avec la version que la base a enregistrée (voir
`supabase/migrations/README.md`).

| Brouillon | Pour quoi | Tests |
| --- | --- | --- |
| `ai_credits.sql` | Crédits IA, marche 1 : solde et journal (`strategie/offres.md`) | `tests/run.sh` (20 tests) |

## Tester

Sur une base Postgres **vide et jetable** (jamais la prod ni la preprod) :

```bash
./tests/run.sh "postgresql://postgres@localhost:5432/tiroir_drafts_test"
```

## Appliquer `ai_credits.sql` en prod

1. Supabase → SQL Editor : coller le fichier, exécuter. Il est additif et
   peut être rejoué sans effet.
2. Relire la version enregistrée, puis déplacer le fichier dans
   `supabase/migrations/<version>_ai_credits.sql`.
