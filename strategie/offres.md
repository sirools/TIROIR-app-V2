# Les formules de Tiroir

## Décision du 19 octobre 2026 — la grille V4 est figée

Décision du fondateur : **une seule grille, la même partout et pour toute
la durée du projet** — site, App Store, Google Play, RevenueCat, Stripe,
fiches de Torix. Elle remplace la grille du 30 septembre ci-dessous
(conservée pour l'historique). Source unique dans le code :
`OFFERS_V4` (`web/lib/offers.ts`). Stripe (test) la porte déjà.

| Formule | Contenu | Prix TTC | Où l'acheter |
| --- | --- | --- | --- |
| **Free** | Objets et collections illimités, 20 actions IA par mois | 0 € | — |
| **Packs de crédits** | 50 · 150 · 500 crédits, sans expiration | 2,99 € · 6,99 € · 19,99 € | App (achat intégré) |
| **Premium** | Estimation, courbe de valeur, liens protégés… | 4,99 €/mois ou 39 €/an | App (abonnement) |
| **Pro** | Tout le Premium, avec des quotas plus élevés | 14,99 €/mois | App (abonnement) ; plus tard site (Stripe) |
| **Business** | Tout le Pro par membre, rôles, facture | 39 € par siège/mois | Sur facture ; plus tard site (Stripe) |

### Pro = Premium avec plus de quotas (décision du 19/10)

Le palier `pro` existe déjà dans le système et fonctionne ainsi : mêmes
fonctionnalités que Premium, quotas mensuels plus élevés, réglables dans
le back-office (onglet Quotas). Valeurs par défaut du code, à confirmer
dans le back-office de prod :

| | Unités IA / mois | Retouches photo / mois |
| --- | --- | --- |
| Premium | 150 | 50 |
| **Pro (proposé : garder)** | **300** | **100** |

Marge au pire cas (quota entièrement consommé ; 1 unité ≈ 1 centime
d'IA, 1 retouche ≈ 3,9 centimes — `strategie/torix-et-tiroir.md` § 3) :

| | Net par mois* | Coût IA au pire | Marge au pire |
| --- | --- | --- | --- |
| Pro 14,99 € (store) | ≈ 10,62 € | ≈ 6,90 € | ≈ + 3,70 € |
| Pro 14,99 € (Stripe, site) | ≈ 12,00 € | ≈ 6,90 € | ≈ + 5,10 € |
| Premium 4,99 €/mois (store) | ≈ 3,53 € | ≈ 3,45 € | ≈ 0 € |
| Premium 39 €/an (store) | ≈ 2,30 €/mois | ≈ 3,45 € | **≈ − 1,15 €** |

\* Après TVA (20 %) et commission des stores (15 %) ; Stripe ≈ 1,5 % +
0,25 €. L'usage réel est très inférieur au pire cas (§ 4 de
`torix-et-tiroir.md` : ~1,50 $/mois pour un payant), mais **l'annuel
Premium perd de l'argent sur un gros consommateur** : à surveiller, ou
réduire les retouches photo Premium (50 → 30 ramènerait le pire cas à
≈ 2,67 €). À trancher par le fondateur.

### Ce qu'il reste pour que l'argent rentre

1. **Stores** (depuis un ordinateur) : aligner les produits sur la grille,
   pas à pas dans `strategie/packs-stores.md`.
2. **Code** (une PR, prête avant les stores) : identifiants des nouveaux
   packs dans l'app et le webhook RevenueCat ; webhook qui attribue le
   palier `pro` aux abonnés Pro des stores (aujourd'hui, tout abonnement
   store donne `premium`) ; écran d'abonnement de l'app avec Pro.
   Nouvelle version de l'app à publier (revue Apple et Google).
3. **Site** : la page Tarifs renvoie vers l'app pour Premium et les
   crédits (PR #72), puis Pro dès qu'il est en vente dans l'app.
4. **Plus tard** : paiement sur le site par Stripe (Pro, Business), une
   fois le mode réel de Stripe activé.

---

# Historique — grille du 29/30 septembre 2026 (remplacée le 19/10)

Décision du fondateur : quatre façons d'utiliser Tiroir, selon l'usage
de l'IA. Grille révisée le **30 septembre 2026** : prix alignés sur le
marché américain des outils professionnels (jusqu'à 300 $/mois pour un
compte premium), marge forte sur les packs. Les arbitrages marqués
*(équilibre)* ont été confiés à Claude et restent modifiables.

| Formule | Contenu | Prix TTC | Net pour Tiroir* |
| --- | --- | --- | --- |
| **Gratuit** | 20 objets avec l'IA, offerts une fois | 0 € | — |
| **Petit pack** | 30 crédits | 4,99 € | ≈ 3,54 € |
| **Grand pack** | 80 crédits | 9,99 € | ≈ 7,08 € |
| **Premium** | IA illimitée, usage raisonnable | 49,99 €/mois | ≈ 35,40 € |
| **Pro** | Tout Tiroir, toute l'IA, 20 000 crédits inclus par mois ; au-delà 0,05 € HT le crédit | à partir de 1 700 € HT/mois | ≈ 1 500 € (socle, sans store) |

\* Après TVA (20 %) et, pour les achats dans l'app, commission des stores
(15 %). Coût IA : quelques centimes pour 30 fiches simples, soit une marge
supérieure à 90 % sur les packs.

## L'échelle : chaque palier donne envie du suivant

- **Gratuit → Freemium** : les 20 objets offerts font découvrir l'IA ; pour
  continuer sans s'engager, un petit pack suffit.
- **Freemium → Premium** : dès qu'on rachète des packs souvent, le Premium
  illimité revient moins cher.
- **Premium → Pro** : quand l'usage devient professionnel (gros volumes,
  équipe, facture, contrat), le Pro garantit tout, sans plafond, au prix
  réel de la consommation.

## Les arbitrages

1. **Gratuit et Freemium sont le même compte**. Un compte gratuit reçoit
   **20 objets avec l'IA** à l'inscription (décision du fondateur) ; il
   devient « Freemium » dès qu'il achète un pack.
2. **Deux packs de crédits** (décision du fondateur) : **30 crédits à
   4,99 €** et **80 crédits à 9,99 €**. Achat intégré (App Store, Google
   Play). **Les crédits achetés n'expirent pas** *(équilibre)*.
3. **Quand les packs ne suffisent plus, le Premium prend le relais** :
   **49,99 €/mois**, affiché illimité, avec un plafond invisible de
   **1 000 unités par mois** *(équilibre)*. Au-delà, un message propose le
   Pro ; jamais de coupure sans explication.
4. **Pro, pour les entreprises** (décision du fondateur, 30/09/2026) :
   **licence tout compris** (toute l'IA, tout Tiroir, accès garanti,
   support prioritaire, export, devis et contrat), **socle de 1 700 € HT
   par mois** incluant **20 000 crédits IA**, puis **0,05 € HT par crédit**
   au-delà. Le prix suit ce que l'entreprise consomme vraiment : un crédit
   coûte environ 1 centime d'IA, donc le socle en coûte environ 200 € et
   chaque crédit en plus rapporte 5 fois son coût — jamais de perte sur un
   gros client. Exemple : 50 000 crédits par mois → 1 700 € + 30 000 ×
   0,05 € = 3 200 € HT. L'outil génère le devis à partir de la
   consommation prévue ; l'entreprise le signe en ligne (DocuSign ou autre
   signature électronique) ou par contrat classique. Pas de commission des
   stores.
5. **Les données appartiennent à leur propriétaire, dans toutes les
   formules** : export complet (fiches, photos, documents) pour tous.
6. **Les abonnés actuels gardent leur prix** (6,99 €/mois) tant qu'ils
   restent abonnés : Tiroir respecte les règles d'Apple et de Google sur les
   changements de prix d'un abonnement en cours. Les nouveaux prix
   s'appliquent aux nouveaux abonnements.
7. **Les inscrits gratuits actuels** *(équilibre)* gardent leurs analyses
   mensuelles jusqu'à la bascule, puis reçoivent **20 objets avec l'IA
   offerts** une fois. Prévenus par e-mail avant.

> Tant que le code n'a pas changé, l'app, la page Tarifs et les fiches de
> Torix affichent encore l'ancienne grille (6,99 € et 29 €). Elles seront
> mises à jour à la marche 5, avec le test `torixKnowledge.test.ts`.

## Ce que coûte un crédit

Un crédit = une unité du système actuel, déjà pondéré par le coût réel
(`strategie/torix-et-tiroir.md`, § 3) :

| Action | Crédits |
| --- | --- |
| Fiche d'objet (analyse simple) | 1 |
| Scène Premium (Sonnet) | 4 |
| Scène Pro (Opus) | 13 |
| Amélioration de photo (image générée) | 4 *(à confirmer)* |
| Estimation de valeur (recherche web) | 8 *(à confirmer)* |

Marge sur le petit pack (30 crédits à 4,99 €) : environ 3,54 € nets après
TVA (20 %) et store (15 %), pour un coût IA de quelques centimes à 25
centimes selon l'usage.

## Escalier de réalisation

1. **Base** : solde de crédits par compte, avec un journal (achat,
   consommation, remboursement en cas d'échec de l'IA). Additif.
   ✅ **En prod depuis le 30/09/2026** :
   `supabase/migrations/20260930080000_ai_credits.sql`.
2. **Consommation** : les fonctions IA débitent les crédits d'un compte
   gratuit au lieu de son quota mensuel.
   ✅ Écrit et testé pour toutes les dépenses IA : analyses, retouche
   photo et vignettes (4 crédits, ouvertes aux comptes gratuits qui paient
   en crédits), estimation de valeur (8 crédits) :
   `supabase/drafts/ai_credits_spend.sql` et `functions/_shared/aiSpend.ts`.
   ✅ Trou fermé : un compte ne peut plus remettre ses quotas à zéro ; les
   remboursements passent par le serveur, une fois par dépense.
3. **Achat** : deux produits consommables dans RevenueCat, App Store et
   Google Play ; le webhook crédite le compte.
   ✅ Code prêt (écran Premium de l'app, webhook). Reste à créer les
   produits : `strategie/packs-stores.md`.
4. **Premium illimité** : plafond de 1 000 unités, message au-delà ;
   nouveaux produits d'abonnement à 49,99 € (les anciens restent actifs
   pour les abonnés actuels).
5. **Page Tarifs** et écran d'achat dans l'app.
6. **Bascule des inscrits actuels** : e-mail, 20 objets avec l'IA offerts.
7. **Devis Pro** : l'outil génère un devis selon la consommation prévue
   (socle 1 700 € HT avec 20 000 crédits, puis 0,05 € HT par crédit) ;
   facture mensuelle au réel ; signature électronique (DocuSign ou autre)
   ou contrat classique.

À chaque marche : mise à jour des fiches de Torix
(`web/components/torix/knowledge.ts`), exigée par le test
`torixKnowledge.test.ts`.
