# Les formules de Tiroir — décision du 29 septembre 2026

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
| **Pro** | Sur devis, facturé selon la consommation de crédits IA | à partir de 2 200 €/mois | ≈ 1 833 € (sans store) |

\* Après TVA (20 %) et, pour les achats dans l'app, commission des stores
(15 %). Coût IA : quelques centimes pour 30 fiches simples, soit une marge
supérieure à 90 % sur les packs.

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
4. **Pro, pour les entreprises** : **sur devis**, facturé selon la
   consommation de crédits IA, **à partir de 2 200 €/mois**. L'outil génère
   le devis ; l'entreprise le signe en ligne (DocuSign ou autre signature
   électronique) ou par un contrat classique. Pas de commission des stores.
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
   ✅ Écrit et testé : `supabase/drafts/ai_credits.sql` (à appliquer en
   prod, voir `supabase/drafts/README.md`).
2. **Consommation** : les fonctions IA débitent les crédits d'un compte
   gratuit au lieu de son quota mensuel.
3. **Achat** : deux produits consommables dans RevenueCat, App Store et
   Google Play ; le webhook crédite le compte.
4. **Premium illimité** : plafond de 1 000 unités, message au-delà ;
   nouveaux produits d'abonnement à 49,99 € (les anciens restent actifs
   pour les abonnés actuels).
5. **Page Tarifs** et écran d'achat dans l'app.
6. **Bascule des inscrits actuels** : e-mail, 20 objets avec l'IA offerts.
7. **Devis Pro** : l'outil génère un devis selon la consommation prévue ;
   signature électronique (DocuSign ou autre) ou contrat classique.

À chaque marche : mise à jour des fiches de Torix
(`web/components/torix/knowledge.ts`), exigée par le test
`torixKnowledge.test.ts`.
