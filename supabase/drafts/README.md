# Brouillons de migrations (Tiroir en prod)

Migrations écrites et testées, **pas encore appliquées** à la prod. Une fois
appliquées, elles passent dans `supabase/migrations/` sous le nom
`<version>_<nom>.sql`, avec la version que la base a enregistrée (voir
`supabase/migrations/README.md`).

| Brouillon | Pour quoi | Tests |
| --- | --- | --- |
| ~~`ai_credits.sql`~~ | ✅ **En prod depuis le 30/09/2026** : `supabase/migrations/20260930080000_ai_credits.sql` | `tests/run.sh` (20 tests) |
| ~~`ai_credits_spend.sql`~~ | ✅ **En prod depuis le 08/11/2026** : `supabase/migrations/20261108143238_ai_credits_spend.sql`, fonctions IA et revenuecat-webhook redéployées dans la foulée. | `tests/run.sh` (31 tests) |
| `profiles_locale.sql` | Langue des comptes : `profiles.locale`, recopiée de `user_metadata.locale` (posée par le site et l'app dès l'inscription), suivie à chaque changement, rattrapée pour les comptes existants. Prépare les e-mails dans la langue du compte | `tests/run_locale.sh` (11 tests, base à part) |
| ~~`stripe_credits.sql`~~ | ✅ **En prod depuis le 08/11/2026** : `supabase/migrations/20261108143328_stripe_credits.sql`. | `tests/run.sh` |
| `business_billing.sql` | Formule Business : organisations, membres, factures, droits Pro des membres sans toucher aux Premium. | `tests/run.sh` |
| ~~`stripe_subscriptions.sql`~~ | ✅ **En prod depuis le 08/11/2026** : `supabase/migrations/20261108130727_stripe_subscriptions.sql` (avec `20261108130004_stripe_events.sql`, la table d'événements extraite de `stripe_credits.sql`). | Abonnements Premium / Pro achetés sur le site : client et abonnement Stripe sur `profiles`, statut, fin de période, `plan_source` (web / app) ; journal `subscriptions` toutes sources (stripe, apple, google) ; palier posé par le webhook seul, sans toucher aux paliers de l'app ni aux Pro sur facture. Après `business_billing.sql`. | `tests/run.sh` |
| ~~`stripe_end_keeps_store.sql`~~ | ✅ **En prod depuis le 09/11/2026** : `supabase/migrations/20261109050731_stripe_end_keeps_store.sql`, après sauvegarde (fonction et colonnes de facturation). Retour arrière : `rollback/stripe_end_keeps_store.rollback.sql` (définition de prod relevée juste avant). Audit du 09/11/2026 : quand un abonnement du site s'arrête, un abonnement Apple ou Google encore payé (journal `subscriptions`) prend le relais au lieu de faire retomber le compte en gratuit. `CREATE OR REPLACE` de `apply_stripe_subscription`, additif, rejouable. | `tests/run.sh` (7 tests) |
| ~~`refund_ai_credits_lock.sql`~~ | ✅ **En prod depuis le 09/11/2026** : `supabase/migrations/20261109055040_refund_ai_credits_lock.sql`, droits relevés juste avant (identiques à la sauvegarde). Après : `{postgres,service_role}=X`, authenticated et anon sans droit, définition inchangée. Ferme un trou ouvert en prod : un compte connecté pouvait se rendre lui-même des crédits dépensés (`refund_ai_credits`). Un `REVOKE` aux comptes, à anon et à PUBLIC ; service_role garde le droit. Aucun appelant (vérifié le 09/11/2026), aucune donnée modifiée. Retour arrière : `rollback/refund_ai_credits_lock.rollback.sql` (droits de prod relevés le 09/11/2026). | `tests/run.sh` (10 tests) |

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
`stripe_credits.sql`, puis `business_billing.sql`, puis `stripe_subscriptions.sql`.
Additifs. Après `stripe_subscriptions.sql` seulement : redéployer
`revenuecat-webhook` (il lit et écrit `profiles.plan_source`).

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
