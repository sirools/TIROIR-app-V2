# Brouillons de migrations (Tiroir en prod)

Migrations écrites et testées, **pas encore appliquées** à la prod. Une fois
appliquées, elles passent dans `supabase/migrations/` sous le nom
`<version>_<nom>.sql`, avec la version que la base a enregistrée (voir
`supabase/migrations/README.md`).

| Brouillon | Pour quoi | Tests |
| --- | --- | --- |
| ~~`ai_credits.sql`~~ | ✅ **En prod depuis le 30/09/2026** : `supabase/migrations/20260930080000_ai_credits.sql` | `tests/run.sh` (20 tests) |
| `ai_credits_spend.sql` | Crédits IA, marches 2 et 2 bis : toute dépense IA (analyse, retouche, estimation) puise dans le quota puis dans les crédits ; remboursements réservés au serveur (trou fermé) | `tests/run.sh` (31 tests) |
| `profiles_locale.sql` | Langue des comptes : `profiles.locale`, recopiée de `user_metadata.locale` (posée par le site et l'app dès l'inscription), suivie à chaque changement, rattrapée pour les comptes existants. Prépare les e-mails dans la langue du compte | `tests/run_locale.sh` (11 tests, base à part) |
| `stripe_credits.sql` | Crédits achetés sur le site (Stripe) : achats, reprise des crédits après remboursement (`reversal`, négatif), événements Stripe traités une fois, historique du compte (journal + quota du mois). Après `ai_credits_spend.sql`. | `tests/run.sh` |
| `business_billing.sql` | Formule Business : organisations, membres, factures, droits Pro des membres sans toucher aux Premium. | `tests/run.sh` |

## Tester

Sur une base Postgres **vide et jetable** (jamais la prod ni la preprod) :

```bash
./tests/run.sh "postgresql://postgres@localhost:5432/tiroir_drafts_test"
```

## Appliquer en prod, dans l'ordre

1. ✅ `ai_credits.sql` — fait (30/09/2026) ;
2. `ai_credits_spend.sql` ;
3. **aussitôt**, redéployer les fonctions `detect-scene`,
   `describe-object`, `chat-turn`, `enhance-object-photo`,
   `scene-thumbnail`, `estimate-value` et `revenuecat-webhook` :

   ```bash
   supabase functions deploy detect-scene describe-object chat-turn \
     enhance-object-photo scene-thumbnail estimate-value revenuecat-webhook
   ```

Puis, le jour où le paiement par Stripe ouvre (`strategie/paiements-stripe.md`) :
`stripe_credits.sql`, puis `business_billing.sql`. Additifs ; aucun redéploiement
de fonction nécessaire.

Pourquoi « aussitôt » : l'étape 2 retire aux comptes le droit de se
rembourser eux-mêmes. Les anciennes fonctions, qui remboursaient au nom du
compte, ne rendraient plus un quota en cas d'échec de l'IA. Les nouvelles
fonctions marchent avant comme après le SQL (repli sur les anciens quotas,
`_shared/aiSpend.ts`).

## Appliquer `profiles_locale.sql` en prod

Indépendant des crédits : peut passer avant ou après.

1. Supabase → SQL Editor : coller le fichier, exécuter. Additif, rejouable.
2. Vérifier : `select locale, count(*) from profiles group by 1;`
3. Relire la version enregistrée, puis déplacer le fichier dans
   `supabase/migrations/<version>_profiles_locale.sql`.

Rien d'autre à redéployer : le site et l'app posent déjà la langue dans
`user_metadata.locale` ; ce SQL la recopie dans `profiles`.

## Appliquer `ai_credits.sql` en prod

1. Supabase → SQL Editor : coller le fichier, exécuter. Il est additif et
   peut être rejoué sans effet.
2. Relire la version enregistrée, puis déplacer le fichier dans
   `supabase/migrations/<version>_ai_credits.sql`.
