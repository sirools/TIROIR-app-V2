# Paiements par Stripe — crédits IA sur le site et facturation Business

> Rédigé le 26/10/2026 (branche `claude/tiroir-credits-billing-9k30og`).
> Rien n'est en prod : SQL en brouillon, Stripe en **mode test**, pas de
> merge sur `main` sans validation du fondateur. Tout se teste en préprod
> (NAS), avec les cartes et IBAN de test de Stripe.

## 0. Ce qu'il faut décider avant d'aller plus loin

1. ✅ **Mobile — décidé le 26/10/2026** : achat intégré dans l'app
   (RevenueCat, déjà codé) **et** Stripe sur le site, en parallèle, sans
   lien de l'app vers le site (option B, § 1). Aucune ligne de code
   mobile dans cette branche ; ce qu'il reste côté app est listé au § 1.
2. ✅ **TVA — décidé le 26/10/2026** : Tiroir (EI) est en **franchise en
   base**. Aucune TVA facturée ; les factures portent « TVA non
   applicable, art. 293 B du CGI » ; 39 € TTC = 39 € HT, et un pack à
   6,99 € rapporte 6,99 € (avant frais Stripe). C'est le réglage par
   défaut du code (`vatMode`, `web/lib/stripeConfig.ts`). Le jour où le
   seuil est dépassé : `BILLING_VAT_MODE=assujetti`, un taux de TVA dans
   Stripe (§ 6.9) et revoir les prix TTC.
3. **Proratisation Business** : option retenue par défaut ci-dessous
   (§ 3), à valider.
4. **Délai de grâce** en cas d'impayé : 14 jours par défaut
   (`BUSINESS.graceDays`, `web/lib/stripeConfig.ts`).

## 1. Mobile : vendre des crédits dans l'app iOS / Android

Les crédits IA sont un bien numérique consommé dans l'app. Règle générale :
**Apple (guideline 3.1.1) et Google (politique Paiements de Play) imposent
leur achat intégré** pour vendre ce type de contenu dans l'app ; renvoyer
vers un paiement externe est interdit, sauf exceptions par pays. Ces
exceptions bougent vite (procès Epic, DMA) : **à revérifier dans les
règles en vigueur le jour de la décision**. État connu à date :

| Zone | Apple | Google |
| --- | --- | --- |
| États-Unis | Depuis l'injonction de 2025 (Epic c. Apple), lien ou bouton vers un achat web autorisé sur le storefront US, sans commission — décision encore contestée en appel | Depuis fin 2025 (Epic c. Google), liens et paiements alternatifs autorisés aux US ; conditions et frais fixés par Google |
| Union européenne (DMA) | « StoreKit External Purchase Link » : lien autorisé sur demande d'habilitation, avec écran d'avertissement imposé et frais Apple (≈ 2 % d'acquisition + 5 à 13 % de services + contribution technologique) | Programme « offres externes » de l'EEE : lien autorisé, frais Google réduits mais non nuls |
| Reste du monde | Interdit (hors cas particuliers : Corée du Sud, Japon…) | Facturation alternative possible dans certains pays, frais réduits de 4 points seulement |

Ce qui reste permis partout : **utiliser dans l'app des crédits achetés
ailleurs** (Apple 3.1.3(b), « multiplatform services »), **à condition que
l'achat intégré existe aussi dans l'app**.

### Les trois options

| | A. Achat web uniquement | B. Achat intégré + web en parallèle *(recommandé)* | C. Lien externe depuis l'app |
| --- | --- | --- | --- |
| Dans l'app | Aucun achat ; refus « quota atteint » sans solution | Packs vendus par l'achat intégré (RevenueCat, déjà codé) | Bouton « Acheter sur tiroir.app » dans les pays où c'est permis |
| Commission | 0 % | 15 % (programme petites entreprises) sur les ventes de l'app, 0 % + frais Stripe sur le site | 0 % (US), ~7–20 % (UE), interdit ailleurs |
| Conversion | Faible : l'utilisateur bloqué dans l'app ne sait pas quoi faire, et l'app n'a pas le droit de le lui dire | Bonne : achat en deux touches dans l'app, le site en plus | Moyenne : on quitte l'app, puis on revient |
| Risque de rejet | **Élevé chez Apple** : crédits consommés dans l'app sans achat intégré (3.1.3(b) exige l'achat intégré en parallèle) | Faible : c'est le cas prévu par les règles | Moyen : logique par pays, habilitation Apple UE, écran imposé, règles encore mouvantes aux US |
| Travail | Retirer l'écran de packs de l'app | Aucun nouveau : les produits stores restent à créer (`strategie/packs-stores.md`) | Code par storefront, demandes d'habilitation, revue Apple/Google |

**Décision du fondateur (26/10/2026) : B.** Un seul journal de crédits (`ai_credit_ledger`) :
qu'un pack soit acheté dans l'app ou sur le site, il crédite le même solde
(références `rc:…` ou `stripe:…`). L'app ne mentionne jamais le site pour
acheter ; le site, lui, peut vendre librement. Même grille partout
(décision du 19/10) : le site rapporte simplement plus à Tiroir (pas de
commission). Revoir C plus tard pour les seuls États-Unis si leur part
devient significative.

**Conséquence pour le refus « quota atteint »** : sur le web, la page
`/credits` affiche le bandeau et le bouton « Acheter des crédits ». Dans
l'app, le bouton doit ouvrir l'écran d'achat intégré, **pas le site** —
c'est le seul code mobile à écrire, après décision (les fonctions IA
renvoient déjà `QUOTA_EXCEEDED`, `supabase/functions/_shared/aiSpend.ts`).

### Reste à faire côté app (après la décision B)

1. **Produits stores alignés sur la grille V4** (50 / 150 / 500 crédits) :
   `strategie/packs-stores.md`, puis identifiants dans
   `mobile/src/lib/creditPacks.ts` et le webhook RevenueCat (le test
   `creditPacks.test.ts` les compare). Aujourd'hui l'app vend encore les
   packs 30 / 80 de la grille du 30/09.
2. **Bouton « Acheter des crédits » sur chaque refus `QUOTA_EXCEEDED`**,
   qui ouvre l'écran d'achat intégré (`mobile/app/(app)/paywall.tsx`).
   Aujourd'hui, seule la retouche photo traite ce code
   (`objects/[id].tsx`), par une simple alerte ; l'analyse de scène
   affiche le message brut (`capture/scene.tsx`).
3. **Aucune mention du site** pour acheter dans l'app (ni lien, ni prix
   web, ni « moins cher sur le site »).
4. Nouvelle version de l'app à publier (revue Apple et Google).

## 2. Crédits IA sur le site (tâche 1)

| Étape | Où |
| --- | --- |
| Produits et prix (3 packs, siège Business), identifiés par `lookup_key` | `scripts/stripe-setup.mjs`, config unique `web/lib/stripeConfig.ts` (prix tirés de `OFFERS_V4`) |
| Achat (compte connecté) → Stripe Checkout | page `/credits`, route `POST /api/stripe/checkout` |
| Crédit du compte | `POST /api/stripe/webhook` → `checkout.session.completed` (ou `async_payment_succeeded` pour un paiement différé) → `record_stripe_credit_purchase` |
| Remboursement | `charge.refunded` → `reverse_stripe_credit_purchase` : écriture **négative** `reversal`, au prorata si partiel |
| Journal | `ai_credit_ledger` (en prod depuis le 30/09) — pas de second journal |
| Consommation | `spend_ai` (brouillon `ai_credits_spend.sql`) : quota du mois d'abord, crédits ensuite, refus propre sinon |
| Solde, historique | `get_my_ai_credits`, `get_my_credit_history` (journal + quota du mois) |

**Correspondance avec le brief** (« table `credit_ledger` ») : la table
existe déjà sous le nom `ai_credit_ledger`, avec RLS (lecture de ses
seules lignes, aucune écriture par un compte). Raisons : achat =
`purchase`, consommation = `consume`, remboursement Stripe = `reversal`
(nouveau, négatif), crédit rendu après un échec de l'IA = `refund`. Le
**quota mensuel** n'est pas un solde (il se remet à zéro) : ses dépenses
vivent dans `ai_spends` (source `quota`) et apparaissent dans
l'historique, sans entrer dans le solde.

**Garanties** :
- signature vérifiée sur le corps brut, horodatage de moins de 5 min ;
- un serveur en mode test refuse les événements réels, et inversement ;
- chaque événement n'est traité qu'une fois (`stripe_events`), et chaque
  traitement est idempotent en base (référence unique par achat, reprise
  cumulée par remboursement) : rejouer un événement ne crédite jamais deux
  fois ;
- le nombre de crédits vient de la config du serveur, jamais des
  métadonnées de la session ;
- un remboursement après dépense peut rendre le solde négatif : l'IA
  payante est alors bloquée jusqu'au prochain achat ;
- droit de rétractation : case obligatoire avant le paiement (accès
  immédiat demandé, renonciation — art. L221-28 du Code de la
  consommation), horodatée dans les métadonnées du paiement.

## 3. Facturation Business (tâche 2)

- **Modèle** : `organizations`, `org_members` (owner / admin / member ;
  un compte est membre actif d'une seule organisation), `billing_invoices`
  (miroir des factures Stripe). Brouillon `supabase/drafts/business_billing.sql`.
- **Abonnement** : un client Stripe par organisation, un abonnement au
  prix « siège » (39 €/mois TTC), `quantity` = membres actifs,
  `collection_method = send_invoice`, échéance 30 jours, paiement par
  virement (IBAN dédié Stripe) ou prélèvement SEPA.
- **Parcours** : le fondateur crée l'organisation et son owner dans le
  back-office (`/admin/facturation`), puis « Démarrer l'abonnement ».
  L'owner et ses admins gèrent ensuite l'équipe sur `/equipe` (ajout par
  adresse d'un compte Tiroir existant, retrait).
- **Droits** : tant que l'abonnement est actif, chaque membre a le palier
  `pro` existant, avec `pro_expires_at` = fin de période + 14 jours. Pas
  de tâche planifiée : `effective_plan()` fait retomber un compte échu en
  gratuit. **Les comptes Premium et les Pro attribués à la main ne sont
  jamais modifiés** : ils gardent leur palier (affiché « garde son
  abonnement » dans l'équipe), et l'organisation ne leur reprend rien.
- **Impayé** : `invoice.payment_failed` ou abonnement `past_due` → les
  droits s'arrêtent 14 jours après le premier impayé (jamais repoussé par
  les relances) ; `unpaid` ou `canceled` → retour immédiat au gratuit.
- **Webhooks** : `invoice.paid`, `invoice.payment_failed`,
  `customer.subscription.updated`, plus `customer.subscription.created`,
  `customer.subscription.deleted` (résiliation), `invoice.finalized`
  (numéro, échéance), `invoice.voided`, `invoice.marked_uncollectible`.
  Chaque événement relit l'objet actuel chez Stripe : un événement en
  retard n'écrase pas un état plus récent.
- **Cas limites connus** (non traités, pour ne pas toucher au webhook
  RevenueCat ni aux Premium) : un membre qui a le Pro par son organisation
  et s'abonne **en plus** au Premium dans l'app reste affiché Pro (le
  webhook RevenueCat ne rétrograde jamais un Pro) ; si l'organisation
  s'arrête, il repasse gratuit jusqu'au prochain renouvellement de son
  abonnement store, qui le remet Premium. À l'inverse, un Premium dont
  l'abonnement store expire pendant qu'il est membre ne reçoit le Pro de
  l'organisation qu'au prochain événement Stripe (facture, changement de
  sièges). Rares ; à revoir si ça arrive.

### Proratisation (à valider)

| Option | Ajout d'un membre | Retrait d'un membre | Pour |
| --- | --- | --- | --- |
| **Retenue par défaut** | Prorata ajouté à la **facture suivante** (`create_prorations`) | Pas d'avoir : siège payé jusqu'à la fin du mois (`none`) | Une facture par mois, pas de remboursement à gérer en virement |
| Facture immédiate | Petite facture à chaque ajout (`always_invoice`) | Avoir immédiat | Trésorerie au plus juste, mais beaucoup de petites factures à payer par virement |
| Sans prorata | Pris en compte au mois suivant (`none`) | Idem | Le plus simple ; un membre ajouté en début de mois est presque gratuit |

Réglage : `BUSINESS.proration` dans `web/lib/stripeConfig.ts`.

## 4. Suivi des revenus (tâche 3)

Back-office → **Facturation** (`https://backoffice.tiroir.app/admin/facturation`) :
MRR Business, encaissé par mois (crédits / Business), « qui facture qui »
(date, client, objet, montant, moyen, statut), clients Business (membres
vs sièges facturés, avec bouton de resynchronisation en cas d'écart), et
une **projection à date** (par défaut le prochain 25 décembre, date au
choix) : MRR prolongé + crédits au rythme moyen des 90 derniers jours +
factures émises non payées. Sans croissance supposée : un ordre de
grandeur. Montants TTC bruts, avant frais Stripe. Les ventes des stores
(RevenueCat) n'y sont pas.

## 5. Factures conformes (droit français)

Ce que Stripe et le code couvrent, et ce qui reste à faire :

| Mention / règle | Où |
| --- | --- |
| Numérotation continue, chronologique, sans trou | Dashboard Stripe : numérotation **au niveau du compte** (pas par client), préfixe ex. `TIROIR-` — action manuelle |
| Vendeur : nom suivi de « EI », adresse, SIREN/SIRET | Dashboard (infos publiques de l'entreprise) **et** pied de facture (`BILLING_LEGAL_NAME`, `BILLING_SIRET`, `BILLING_ADDRESS`) |
| TVA : « TVA non applicable, art. 293 B du CGI » (franchise en base, confirmée) | Pied de facture, par défaut ; plus tard `BILLING_VAT_MODE=assujetti` + `BILLING_VAT_NUMBER` + `STRIPE_TAX_RATE_ID` |
| Client : raison sociale, adresse, SIREN, n° de TVA | Fiche de l'organisation (back-office) → client Stripe (SIREN en champ personnalisé, TVA en `tax_id`) |
| Nature : prestations de services ; période ; quantité ; prix unitaire | Pied de facture ; lignes Stripe (période et sièges) |
| Échéance, pénalités de retard, indemnité de 40 €, pas d'escompte | Pied de facture (`invoiceFooter`) ; échéance 30 jours |

**À surveiller — facturation électronique** : toutes les entreprises
doivent pouvoir **recevoir** des factures électroniques depuis le
01/09/2026 ; les micro et petites entreprises devront les **émettre** au
format structuré (Factur-X, UBL, CII) via une plateforme agréée à partir
du 01/09/2027. Les PDF de Stripe ne suffiront pas alors pour le B2B : à
anticiper avec le comptable (plateforme agréée branchée sur Stripe, ou
export).

**Crédits vendus aux particuliers** : pas de facture obligatoire (reçu
Stripe), sauf demande du client. Si besoin, Checkout sait émettre une
facture après paiement (`invoice_creation`, payant) — non activé.

**Franchise en base** : seuils 2026 pour les prestations de services
(≈ 37 500 € de chiffre d'affaires, seuil majoré ≈ 41 250 €) à vérifier
chaque année avec le comptable ; au-delà, la TVA s'applique dès le
dépassement et les prix TTC affichés devront intégrer 20 %.

## 6. Actions manuelles dans le dashboard Stripe

En **mode test** d'abord (préprod), puis à refaire en mode réel le jour
de l'ouverture.

1. **Compte** : informations de l'EI (nom + « EI », SIRET, adresse),
   IBAN Shine pour les virements de Stripe vers Tiroir (payouts),
   descripteur bancaire « TIROIR ».
2. **Clés API** : récupérer la clé secrète de test (`sk_test_…`).
   En réel, préférer une **clé restreinte** (`rk_live_…`) : Checkout
   Sessions (écriture), Products et Prices (lecture), Payment Intents et
   Charges (lecture), Customers et Tax IDs (écriture), Subscriptions
   (écriture), Invoices (lecture). Jamais dans le dépôt.
3. **Produits** : `STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-setup.mjs`
   (crée les 3 packs et le siège Business, rejouable). Vérifier ensuite
   dans Produits que les montants sont 2,99 / 6,99 / 19,99 / 39 €.
4. **Moyens de paiement** (Settings → Payment methods) : Carte (avec Apple
   Pay / Google Pay), **Prélèvement SEPA**, **Virements bancaires**
   (solde client, EUR).
5. **Webhook** (Developers → Webhooks → Add endpoint) :
   `https://tiroir.app/api/stripe/webhook` (prod) — version d'API
   `2024-06-20` — événements : `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `charge.refunded`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.finalized`, `invoice.paid`,
   `invoice.payment_failed`, `invoice.voided`,
   `invoice.marked_uncollectible`. Copier le secret `whsec_…`.
   **Préprod** : le NAS n'est pas joignable depuis Internet ; utiliser la
   Stripe CLI depuis le Mac, sur le Wi-Fi de la maison :
   `stripe listen --forward-to http://192.168.1.23:8151/api/stripe/webhook`
   (le `whsec_…` affiché va dans `.env.preprod`).
6. **Factures** (Settings → Billing → Invoices) : numérotation **séquentielle
   au niveau du compte**, préfixe `TIROIR-`, langue français, échéance par
   défaut 30 jours, pied de page par défaut (mêmes mentions que
   `invoiceFooter`, utile pour les factures créées à la main), logo et
   couleur de `design/tokens.json`.
7. **Abonnements et e-mails** (Settings → Billing → Subscriptions and
   emails) : envoyer les factures finalisées par e-mail ; rappels avant et
   après échéance ; **facture impayée 14 jours après l'échéance → marquer
   l'abonnement « unpaid »** (aligné sur le délai de grâce) ; relances
   intelligentes pour le SEPA.
8. **Checkout** (Settings → Checkout / Public details) : nom public
   « Tiroir », e-mail de support, liens CGU (`https://tiroir.app/cgu`) et
   confidentialité (`https://tiroir.app/privacy`) ; reçus par e-mail
   activés (Settings → Emails : paiements réussis, remboursements).
9. **TVA** : rien à faire tant que Tiroir est en franchise en base. Plus
   tard seulement, si le seuil est dépassé : Product catalog → Tax rates
   → « TVA 20 % », inclusive → son id dans `STRIPE_TAX_RATE_ID`.
10. **Préprod, impayé simulé** : Billing → Test clocks → nouvelle horloge
    → son id dans `STRIPE_TEST_CLOCK_ID` (voir § 8, B6).

## 7. Variables d'environnement

| Variable | Préprod (`.env.preprod`) | Prod (Vercel) |
| --- | --- | --- |
| `STRIPE_MODE` | `test` | `live` (le jour de l'ouverture) |
| `STRIPE_SECRET_KEY` | `sk_test_…` | `rk_live_…` (restreinte) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` de `stripe listen` | `whsec_…` de l'endpoint |
| `SITE_URL` | `http://192.168.1.23:8151` | (défaut `https://tiroir.app`) |
| `BILLING_LEGAL_NAME`, `BILLING_SIRET`, `BILLING_ADDRESS` | identité de l'EI | idem |
| `BILLING_VAT_MODE` | rien (franchise par défaut) | rien ; `assujetti` seulement si le seuil est dépassé |
| `STRIPE_TEST_CLOCK_ID` | facultatif (tests d'impayé) | jamais |

Sans `STRIPE_MODE` et une clé du même mode, le paiement reste fermé
(boutons « Bientôt disponible »), et une clé réelle posée en préprod est
refusée.

## 8. Plan de tests en préprod

**Préalable** (préprod uniquement, jamais la prod) : appliquer dans
l'ordre `ai_credits_spend.sql`, `stripe_credits.sql`,
`business_billing.sql` sur le Supabase de préprod (SQL Editor), déployer
les fonctions listées dans `supabase/drafts/README.md`, renseigner les
variables, lancer `stripe listen`, `scripts/stripe-setup.mjs` avec la clé
de test. Les tests SQL automatiques passent d'abord sur une base jetable :
`supabase/drafts/tests/run.sh`.

### Crédits

| # | Scénario | Attendu |
| --- | --- | --- |
| C1 | `/credits`, pack 150, case cochée, carte `4242 4242 4242 4242` | Retour « Paiement reçu » ; solde +150 en quelques secondes ; historique « Achat de crédits · sur le site » ; ligne dans Facturation |
| C2 | Sans cocher la case | Message, aucun appel à Stripe |
| C3 | Carte 3D Secure `4000 0025 0000 3155` : valider / refuser l'authentification | Crédité / rien |
| C4 | Carte refusée `4000 0000 0000 0002` ; puis « Retour » sur Checkout | Rien de crédité ; « Paiement annulé » |
| C5 | Dashboard → Webhooks → renvoyer l'événement de C1 | Solde inchangé (pas de double crédit) |
| C6 | Remboursement partiel de 3,50 € sur 6,99 €, puis du reste | −75, puis −75 ; « Achat remboursé » ; statut « remboursé » dans Facturation |
| C7 | Acheter 50, en dépenser 30, rembourser | Solde −30 ; l'IA ne puise plus dans les crédits |
| C8 | Quota du mois épuisé (régler un quota gratuit bas dans le back-office de préprod), crédits > 0 | L'action IA passe sur les crédits (historique « Action IA (crédits) ») |
| C9 | Quota épuisé et solde 0 | Refus `QUOTA_EXCEEDED` ; `/credits` affiche le bandeau « Acheter des crédits » |
| C10 | Avec la session d'un autre compte, lire `ai_credit_ledger` / `stripe_credit_purchases` (SQL Editor avec son JWT, ou l'app) | Seulement ses lignes |
| C11 | `curl` sur le webhook avec une fausse signature | 400, rien d'écrit |

### Business

| # | Scénario | Attendu |
| --- | --- | --- |
| B1 | Back-office → Facturation → créer « Test SARL » (owner = compte gratuit de test) ; sur `/equipe`, ajouter un compte gratuit et un compte **Premium** | 3 membres ; personne n'a encore le Pro |
| B2 | « Démarrer l'abonnement » | Client et abonnement (3 sièges) dans Stripe ; facture finalisée et envoyée ; les deux gratuits passent Pro ; le Premium reste Premium |
| B3 | Payer par virement : Dashboard → client → « Fund cash balance » (test) du montant de la facture | `invoice.paid` ; facture « payée », moyen « Virement » |
| B4 | Payer la facture suivante en SEPA sur la page de facture, IBAN `FR1420041010050500013M02606` ; puis un échec avec `FR8420041010050500013M02607` | Payée après traitement ; puis `invoice.payment_failed` → « Pro jusqu'au » = aujourd'hui + 14 jours |
| B5 | Ajouter un membre, puis en retirer un | Sièges 3 → 4 (prorata visible sur la facture à venir), puis 4 → 3 sans avoir ; le retiré redevient gratuit |
| B6 | **Impayé simulé** : créer l'organisation avec `STRIPE_TEST_CLOCK_ID` posé ; avancer l'horloge de 31 jours, puis de 14 de plus | `past_due` → droits jusqu'à J+14 ; puis `unpaid` → tous les membres Pro par l'organisation redeviennent gratuits, le Premium garde son palier |
| B7 | Résilier l'abonnement dans le dashboard | `customer.subscription.deleted` → retour au gratuit immédiat |
| B8 | Ouvrir le PDF d'une facture | Numéro `TIROIR-…` continu, mentions de l'EI, « TVA non applicable, art. 293 B du CGI », aucune ligne de TVA, échéance, pénalités et 40 € |

### Revenus

| # | Scénario | Attendu |
| --- | --- | --- |
| R1 | Back-office → Facturation après les tests | MRR = sièges × 39 € ; lignes de C1–C7 et B2–B4 ; projection au 25/12 ; écart sièges/membres signalé en rouge si Stripe n'a pas suivi |

## 9. Ouvrir en prod (plus tard, après validation)

1. Appliquer les trois brouillons en prod, dans l'ordre, puis les ranger
   dans `supabase/migrations/` avec leur version (`supabase/drafts/README.md`).
2. Refaire le § 6 en mode réel ; variables de prod dans Vercel.
3. Relier les boutons « Bientôt disponible » de la page Tarifs à
   `/credits` (le site affiche déjà les prix de la grille V4).
