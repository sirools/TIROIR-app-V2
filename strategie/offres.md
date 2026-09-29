# Les formules de Tiroir — décision du 29 septembre 2026

Décision du fondateur : quatre façons d'utiliser Tiroir, selon l'usage
de l'IA. Les arbitrages marqués *(équilibre)* ont été confiés à Claude
(« fais ce qui te semble le plus équilibré ») et restent modifiables.

| Formule | IA | Paiement |
| --- | --- | --- |
| **Gratuit** | Pas d'IA, hors crédits de bienvenue | 0 € |
| **Freemium** | À la demande | Packs de crédits achetés dans l'app |
| **Premium** | Illimitée, dans un usage raisonnable | Abonnement, 6,99 €/mois |
| **Pro** | Gros volumes | Sur facture (29 €/mois ou 290 €/an) |

## Les arbitrages

1. **Gratuit et Freemium sont le même compte** *(équilibre)*. Un compte
   gratuit n'a pas d'IA ; il devient « Freemium » dès qu'il a des crédits.
   **5 crédits de bienvenue** à l'inscription : sans essai de l'IA, on ne
   comprend pas Tiroir (83 % des premiers inscrits ont ajouté un objet).
2. **Packs de crédits** *(équilibre)* : **20 crédits à 2,99 €**, **50
   crédits à 5,99 €**. Un peu plus chers à l'unité que Premium, pour que
   ceux qui en achètent souvent voient l'intérêt de l'abonnement. Achat
   intégré (App Store, Google Play), commission des stores 15 %.
3. **Les crédits achetés n'expirent pas** *(équilibre)*.
4. **Premium « illimité, usage raisonnable »** *(équilibre)* : affiché
   illimité, avec un plafond invisible de **200 unités par mois**. Au-delà,
   un message propose le Pro ou des crédits ; jamais de coupure sans
   explication.
5. **Pro** : sur facture, sans commission des stores, plafond 300 unités
   par mois (existant), relevable au cas par cas.
6. **Les données appartiennent à leur propriétaire, dans toutes les
   formules** *(équilibre)* : export complet (fiches, photos, documents)
   pour tous. Le Pro y ajoute les exports pour assureur ou expert.
7. **Les inscrits actuels** *(équilibre)* gardent leurs analyses gratuites
   mensuelles jusqu'à la bascule, puis reçoivent **20 crédits offerts** une
   fois. Prévenus par e-mail avant.

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

Marge sur un pack de 20 crédits à 2,99 € : environ 2,12 € nets après TVA
(20 %) et store (15 %), pour un coût IA de 3 à 15 centimes selon l'usage.

## Escalier de réalisation

1. **Base** : solde de crédits par compte, avec un journal (achat,
   consommation, remboursement en cas d'échec de l'IA). Additif.
   ✅ Écrit et testé : `supabase/drafts/ai_credits.sql` (à appliquer en
   prod, voir `supabase/drafts/README.md`).
2. **Consommation** : les fonctions IA débitent les crédits d'un compte
   gratuit au lieu de son quota mensuel.
3. **Achat** : deux produits consommables dans RevenueCat, App Store et
   Google Play ; le webhook crédite le compte.
4. **Premium illimité** : plafond de 200 unités, message au-delà.
5. **Page Tarifs** et écran d'achat dans l'app.
6. **Bascule des inscrits actuels** : e-mail, 20 crédits offerts.

À chaque marche : mise à jour des fiches de Torix
(`web/components/torix/knowledge.ts`), exigée par le test
`torixKnowledge.test.ts`.
