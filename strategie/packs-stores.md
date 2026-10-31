# Mettre la grille V4 en vente — App Store, Google Play, RevenueCat, Stripe

Checklist à suivre **depuis un ordinateur** (les consoles se pilotent mal
depuis un téléphone). Préparée le 31/10/2026 pour la séance du
lendemain. Compter une demi-journée, puis la revue d'Apple et de Google.

**Qui vend quoi** (décision du 26/10/2026, `strategie/paiements-stripe.md`
§ 1, option B — reconfirmée le 31/10/2026) :

| | Dans l'app (iPhone, Android) | Sur le site |
| --- | --- | --- |
| Crédits IA | achat intégré (RevenueCat) | Stripe (page Crédits) |
| Premium, Pro | abonnement des stores (RevenueCat) | renvoi vers l'app |
| Business | — | Stripe, facture mensuelle par siège |

Dans l'app : **aucun lien ni prix du site** pour acheter (règle 3.1.1
d'Apple). Le solde de crédits est le même partout (`ai_credit_ledger`).

---

## Étape 0 — Décider avant d'ouvrir une console (15 min)

Rien ne se crée tant que ces cases ne sont pas remplies : les prix
d'une console ne se reprennent pas proprement, et un produit d'achat
intégré ne se supprime jamais.

- [x] **Stripe pour les crédits : sur le site seulement** — option B du
      26/10, **reconfirmée le 31/10/2026**. Dans l'app, l'achat intégré ;
      aucun lien externe (il demanderait une autorisation d'Apple par pays
      et, dans l'UE, exclurait l'achat intégré).
- [ ] **Les nouveaux prix** (TTC, en euros) — annoncés pour le 01/11 ; à
      reporter dans le tableau ci-dessous, puis à me donner : je mets à jour d'un coup la config des
      paliers, la page Tarifs, les fiches de Torix, Stripe et cette liste.
- [x] **Abonnés en cours : ils gardent leur prix** — **décidé le 31/10/2026**.
      Le nouveau prix ne vaut que pour les nouveaux abonnements : Apple
      « conserver le prix actuel pour les abonnés existants », Google pas de
      migration de prix, Stripe Business abonnements en cours non migrés.
      Les abonnés historiques à 6,99 €/mois gardent aussi ce prix
      (`strategie/offres.md`, point 6).
- [ ] **Pro annuel** : oui ou non ? Et la règle « annuel = 1 mois offert »
      (décision D3 de `V4_PLAN.md`) s'applique-t-elle à Premium et à Pro ?
- [ ] **Packs de crédits** : prix inchangés (2,99 / 6,99 / 19,99 €) ?

## Les produits — identifiants identiques partout

| Identifiant | Où | Type | Prix V4 (19/10) | **Nouveau prix** | Ce que ça donne |
| --- | --- | --- | --- | --- | --- |
| `tiroir_premium_monthly` | stores | abonnement (existe) | 4,99 €/mois | ______ | palier `premium` |
| `tiroir_premium_annual` | stores | abonnement (existe) | 39 €/an | ______ | palier `premium` |
| `tiroir_pro_monthly` | stores | abonnement (**nouveau**) | 14,99 €/mois | ______ | palier `pro` |
| `tiroir_pro_annual` | stores | abonnement (**nouveau, si Pro annuel**) | — | ______ | palier `pro` |
| `tiroir_credits_50` | stores | consommable (**nouveau**) | 2,99 € | ______ | 50 crédits |
| `tiroir_credits_150` | stores | consommable (**nouveau**) | 6,99 € | ______ | 150 crédits |
| `tiroir_credits_500` | stores | consommable (**nouveau**) | 19,99 € | ______ | 500 crédits |
| `tiroir_web_credits_50` · `_150` · `_500` | Stripe | paiement unique | mêmes prix que les packs | ______ | mêmes crédits |
| `tiroir_business_seat_monthly` | Stripe | abonnement par siège | 39 €/siège/mois | ______ | palier `pro` pour chaque membre |

Les anciens packs `tiroir_credits_30` et `tiroir_credits_80`, s'ils ont été
créés : **retirer de la vente, ne jamais supprimer** (le webhook les
reconnaît encore pour les remboursements).

> **Prix introuvable dans une console** (Apple propose surtout des prix en
> ,99) : ne rien improviser, noter le prix le plus proche proposé, et
> afficher le même partout (site, Stripe, stores) — la checklist ISO
> l'exige.

---

## Étape 1 — Avant les consoles : le code et la base (Claude + Clément)

- [ ] **Code mis aux nouveaux prix** (Claude, dès les prix connus) :
      `config/tiers.json`, `web/lib/offers.ts` (`OFFERS_V4`), fiches de
      Torix, `scripts/stripe-setup.mjs`, textes des stores. Les tests
      (`tiersConfig`, `stripeBilling`, `creditPacks`, `torixKnowledge`)
      refusent toute grille incohérente.
- [ ] **Base de prod** : brouillons appliqués dans l'ordre, après passage en
      preprod — `ai_credits_spend.sql`, puis `stripe_credits.sql`, puis
      `business_billing.sql` (`supabase/drafts/README.md`). **Sans eux, un
      achat ne crédite rien.**
- [ ] **Fonctions redéployées** : `revenuecat-webhook` (packs 50/150/500,
      palier Pro des stores), puis `create-share-link`,
      `send-lifecycle-emails`, `chat-turn`, `describe-object`.
- [ ] **Version de l'app** : build EAS de la branche V4 (Pro dans l'écran
      d'abonnement, nouveaux packs, « Acheter des crédits » sur chaque refus
      de quota, portugais). Les nouveaux produits d'achat intégré partent
      **avec** cette version en revue.

## Étape 2 — App Store Connect (iPhone)

1. [ ] **Premium, nouveaux prix** : Tiroir → Monétisation → Abonnements →
   groupe de Premium → `tiroir_premium_monthly` → Prix de l'abonnement →
   nouveau prix (France, puis « tous les pays » au niveau équivalent).
   Choisir **« conserver le prix actuel pour les abonnés existants »**
   (décidé le 31/10). Même chose
   pour `tiroir_premium_annual`.
2. [ ] **Pro** : dans le **même groupe d'abonnements** que Premium, « + » →
   `tiroir_pro_monthly` (1 mois), et `tiroir_pro_annual` (1 an) si décidé.
   Niveau du groupe : **Pro au-dessus de Premium** (montée et descente de
   gamme gérées par Apple).
3. [ ] **Packs** : Monétisation → Achats intégrés → « + » → Consommable →
   `tiroir_credits_50`, `tiroir_credits_150`, `tiroir_credits_500`.
4. [ ] **Noms et descriptions dans les 6 langues** (tableau
   « Textes des produits » ci-dessous) : fr, en, es, de, **pt-BR, pt-PT**
   (ajouter les deux localisations portugaises), plus da si les produits
   existants l'ont déjà.
5. [ ] **Fiche de l'app** : ajouter les localisations Portugais (Brésil) et
   Portugais (Portugal) ; textes de `V4_PLAN.md`, annexe A (sous-titre,
   texte promotionnel, description, nouveautés 4.0). Ne publier les
   lignes courbe de valeur / export / lot que si ces fonctions sont dans
   la version.
6. [ ] Capture de révision de chaque produit : l'écran d'abonnement de l'app.
7. [ ] Soumettre la version de l'app **avec** les nouveaux produits.

## Étape 3 — Google Play Console (Android)

1. [ ] **Premium** : Monétiser → Produits → Abonnements → abonnement
   Premium → offres de base mensuelle et annuelle → nouveaux prix. Pour
   une **hausse**, garder les abonnés existants sur leur prix (« cohorte
   de prix existante ») ; ne **pas** lancer de migration de prix, qui leur
   demanderait leur accord et résilierait ceux qui ne répondent pas.
2. [ ] **Pro** : abonnement `tiroir_pro_monthly` (offre de base mensuelle),
   et offre annuelle si décidée ; statut Actif.
3. [ ] **Packs** : Produits intégrés → `tiroir_credits_50`, `_150`, `_500`,
   statut Actif.
4. [ ] Noms et descriptions dans les 6 langues ; fiche Play en pt-BR et
   pt-PT (annexe A de `V4_PLAN.md`).

## Étape 4 — RevenueCat

1. [ ] **Products** : importer Pro (mensuel, annuel si décidé) et les trois
   packs, pour l'App Store et Google Play.
2. [ ] **Entitlements** : relever leurs identifiants (le code n'en nomme
   aucun — décision D6) ; proposé : `premium` et `pro`.
3. [ ] **Offering courante** (abonnements) : packages Premium mensuel et
   annuel, et `pro_monthly` (+ `pro_annual`), chacun avec ses produits des
   deux stores.
4. [ ] **Offering `credits`** (exactement ce nom, **pas** « current ») :
   trois packages, un par pack.
5. [ ] Webhook vers `revenuecat-webhook` : inchangé.

## Étape 5 — Stripe (site) — mode test d'abord

Procédure complète : `strategie/paiements-stripe.md` § 6 et § 8.

1. [ ] Compte, moyens de paiement, factures, webhook, Checkout : § 6 de
   `paiements-stripe.md` (une seule fois).
2. [ ] **Produits et prix** :
   `STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-setup.mjs` — crée ce qui
   manque, signale (⚠) un prix qui ne correspond plus à la grille.
3. [ ] **Si un prix a changé** :
   `STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-setup.mjs --apply-price-changes`
   — crée le nouveau prix, lui transfère l'identifiant, désactive
   l'ancien. Les abonnements Business **en cours gardent l'ancien prix**
   tant qu'on ne les migre pas.
4. [ ] Plan de tests en preprod : § 8 de `paiements-stripe.md` (crédits C1 à
   C11, Business B1 à B6).
5. [ ] **Mode réel** seulement après validation : refaire 2 et 3 avec la clé
   réelle, variables `STRIPE_*` de prod dans Vercel (§ 7).

## Étape 6 — Vérifier (TestFlight, comptes Sandbox, Stripe test)

1. [ ] L'écran d'abonnement de l'app affiche Premium, Pro et les trois
   packs **aux prix du tableau**, dans la langue de l'appareil.
2. [ ] Acheter le pack de 50 (Sandbox) : 50 crédits arrivent ; dans
   Supabase, `ai_credit_ledger` a une ligne `purchase` de 50.
3. [ ] S'abonner à Pro (Sandbox) : `profiles.plan` passe à `pro`.
4. [ ] Rejouer l'événement depuis RevenueCat : aucune ligne de plus.
5. [ ] Site, page Crédits (Stripe test) : acheter un pack, le solde de
   l'app augmente d'autant.
6. [ ] Business (Stripe test) : ajouter un membre, il passe Pro ; un
   Premium membre garde son abonnement.
7. [ ] **ISO** : la page Tarifs, l'app, les stores et Stripe affichent les
   mêmes prix (checklist ISO de `V4_PLAN.md`, § 8).

---

## Textes des produits (6 langues)

Noms propres non traduits : « Tiroir Premium », « Tiroir Pro ». Les
crédits n'expirent pas : le dire dans chaque description.

| | Tiroir Premium | Tiroir Pro | Pack de crédits (nom · description) |
| --- | --- | --- | --- |
| fr | Estimation automatique de vos objets, courbe de valeur et sources. | Crédits IA inclus, détail des sources, export assurance et estimation en lot. | « {n} crédits IA » · Pour analyser, retoucher ou estimer vos objets. Les crédits n'expirent pas. |
| en | Automatic estimates for your items, value curve and sources. | AI credits included, detailed sources, insurance export and batch estimates. | “{n} AI credits” · To analyse, enhance or estimate your items. Credits never expire. |
| es | Estimación automática de tus objetos, curva de valor y fuentes. | Créditos de IA incluidos, detalle de fuentes, exportación para el seguro y estimación por lotes. | «{n} créditos de IA» · Para analizar, retocar o estimar tus objetos. No caducan. |
| de | Automatische Schätzung deiner Objekte, Wertverlauf und Quellen. | KI-Credits inklusive, Quellen im Detail, Versicherungs-Export und Schätzung im Stapel. | „{n} KI-Credits“ · Zum Analysieren, Verbessern oder Schätzen deiner Objekte. Credits verfallen nicht. |
| pt-BR | Estimativa automática dos seus objetos, curva de valor e fontes. | Créditos de IA incluídos, fontes detalhadas, exportação para o seguro e estimativa em lote. | “{n} créditos de IA” · Para analisar, retocar ou estimar seus objetos. Os créditos não expiram. |
| pt-PT | Estimativa automática dos seus objetos, curva de valor e fontes. | Créditos de IA incluídos, fontes detalhadas, exportação para a seguradora e estimativa em lote. | «{n} créditos de IA» · Para analisar, retocar ou estimar os seus objetos. Os créditos não expiram. |

> Comme pour les fiches store : ne pas annoncer la courbe de valeur,
> l'export assurance ou l'estimation en lot tant que la version publiée
> ne les a pas. À défaut, Premium : « Plus d'analyses IA chaque mois,
> retouches photo et estimations de valeur » ; Pro : « Tout Premium, avec
> plus d'analyses IA et de retouches photo chaque mois » (textes déjà
> dans l'app, `paywall.proHint`).
