# Mettre la grille V4 en vente — App Store, Google Play, RevenueCat

Checklist à suivre **depuis un ordinateur** (les consoles ne se pilotent
pas bien depuis un téléphone). Grille figée le 19/10/2026 :
`strategie/offres.md`. Compter une heure, puis la revue d'Apple.

**Avant tout** : vérifier en prod que les crédits sont en place
(`supabase/drafts/ai_credits.sql` puis `ai_credits_spend.sql` appliqués,
fonctions redéployées — `supabase/drafts/README.md`). Sans ça, un achat
de crédits ne peut pas être crédité.

## Les produits (identifiants identiques partout)

| Identifiant | Type | Prix TTC | Ce que ça donne |
| --- | --- | --- | --- |
| `tiroir_premium_monthly` | Abonnement (existe déjà) | **4,99 €/mois** | palier `premium` |
| `tiroir_premium_annual` | Abonnement (existe déjà) | **39 €/an** | palier `premium` |
| `tiroir_pro_monthly` | Abonnement (**nouveau**) | **14,99 €/mois** | palier `pro` |
| `tiroir_credits_50` | Consommable (**nouveau**) | **2,99 €** | 50 crédits |
| `tiroir_credits_150` | Consommable (**nouveau**) | **6,99 €** | 150 crédits |
| `tiroir_credits_500` | Consommable (**nouveau**) | **19,99 €** | 500 crédits |

Les anciens packs `tiroir_credits_30` et `tiroir_credits_80`, s'ils ont été
créés : **retirer de la vente**, ne pas supprimer (le webhook continue de
les reconnaître pour d'éventuels remboursements).

> **Prix introuvable dans une console** (par exemple 39,00 € chez Apple,
> qui propose surtout des prix en ,99) : ne rien improviser, noter le prix
> le plus proche proposé et me le dire — la grille étant figée, on décide
> ensemble avant de publier.

## 1. App Store Connect (iPhone)

1. **Premium, prix existants** : Tiroir → Monétisation → Abonnements →
   groupe de Premium → `tiroir_premium_monthly` → Prix de l'abonnement →
   nouveau prix 4,99 € (France, puis « tous les pays » au niveau
   équivalent). Même chose pour `tiroir_premium_annual` à 39 €.
   Baisse de prix : les abonnés actuels peuvent en profiter (choisir
   d'appliquer le nouveau prix aux abonnés existants).
2. **Pro** : dans le **même groupe d'abonnements** que Premium, « + » →
   `tiroir_pro_monthly`, durée 1 mois, 14,99 €. Niveau du groupe : **Pro
   au-dessus de Premium** (ça gère seul la montée et la descente de
   gamme). Nom et description dans chaque langue (fr, en, da, de, es).
3. **Packs** : Monétisation → Achats intégrés → « + » → Consommable →
   `tiroir_credits_50` (2,99 €), puis `_150` (6,99 €), `_500` (19,99 €).
   Nom « 50 crédits IA », description « Pour analyser, retoucher ou
   estimer vos objets. Les crédits n'expirent pas. »
4. Capture de révision : l'écran Premium de l'app.
5. Soumettre les nouveaux produits **avec la prochaine version de l'app**
   (celle qui sait les afficher, voir « Code » plus bas).

## 2. Google Play Console (Android)

1. **Premium** : Monétiser → Produits → Abonnements → l'abonnement
   Premium existant → ses offres de base mensuelle et annuelle → prix
   4,99 € et 39 €. Pour les abonnés existants : appliquer la baisse.
2. **Pro** : nouvel abonnement `tiroir_pro_monthly`, offre de base
   mensuelle à 14,99 €, statut Actif.
3. **Packs** : Produits intégrés → créer `tiroir_credits_50`, `_150`,
   `_500` aux prix de la grille, statut Actif.

## 3. RevenueCat

1. **Products** : importer `tiroir_pro_monthly` et les trois packs, pour
   l'App Store et Google Play.
2. **Offering courante** (abonnements) : ajouter un package Pro
   (identifiant `pro_monthly`) avec les deux produits Pro, à côté des
   packages mensuel et annuel de Premium.
3. **Offering `credits`** (exactement ce nom) : trois packages, un par
   pack (50, 150, 500), chacun avec son produit App Store et Google Play.
   Ne pas la mettre « current ».
4. Webhook : rien à changer côté RevenueCat.

## 4. Code (préparé par Claude, à publier avec l'app)

- L'app et le webhook RevenueCat reconnaissent les packs 50, 150, 500.
- Le webhook attribue le palier `pro` à un abonné `tiroir_pro_monthly`
  (aujourd'hui, tout abonnement store donne `premium`), sans toucher aux
  clients Pro sur facture.
- L'écran d'abonnement de l'app propose Pro.
- Nouvelle version de l'app, revue Apple et Google ; redéploiement de la
  fonction `revenuecat-webhook`.

## 5. Vérifier (TestFlight, compte Sandbox)

1. L'écran Premium affiche Premium 4,99 € / 39 €, Pro 14,99 € et les
   trois packs à leur prix.
2. Acheter le pack de 50 : « 50 crédits » arrivent ; dans Supabase,
   `ai_credit_ledger` a une ligne `purchase` de 50.
3. S'abonner à Pro : `profiles.plan` passe à `pro`.
4. Rejouer l'événement depuis RevenueCat : aucune ligne de plus.
5. Le site (page Tarifs) et l'app affichent les mêmes prix.
