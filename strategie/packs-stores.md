# Mettre les packs de crédits en vente — App Store et Google Play

Marche 3 de `strategie/offres.md`. Le code est prêt : l'app affiche les
packs dès qu'ils existent dans RevenueCat, et le webhook crédite le compte.
Il reste à créer les produits chez Apple, chez Google, puis dans RevenueCat.

**Avant tout** : appliquer en prod `supabase/drafts/ai_credits.sql`, puis
`ai_credits_spend.sql`, et redéployer les fonctions (voir
`supabase/drafts/README.md`). Sans ça, un achat ne peut pas être crédité.

| Identifiant (identique partout) | Type | Prix | Crédits |
| --- | --- | --- | --- |
| `tiroir_credits_30` | Consommable | 4,99 € | 30 |
| `tiroir_credits_80` | Consommable | 9,99 € | 80 |

## 1. App Store Connect (iPhone)

1. App Store Connect → Tiroir → **Monétisation → Achats intégrés** → « + ».
2. Type **Consommable**. Référence : « 30 crédits IA ». Identifiant du
   produit : `tiroir_credits_30`.
3. Prix : 4,99 € (niveau de prix correspondant). Nom affiché et
   description dans chaque langue (fr, en, de, es) : « 30 crédits IA » /
   « Pour analyser, retoucher ou estimer vos objets. Les crédits
   n'expirent pas. »
4. Capture d'écran de révision : l'écran Premium de l'app, section packs.
5. Recommencer pour `tiroir_credits_80` (9,99 €, « 80 crédits IA »).
6. Les soumettre avec la prochaine version de l'app.

## 2. Google Play Console (Android)

1. Play Console → Tiroir → **Monétiser → Produits → Produits intégrés** →
   « Créer un produit ».
2. ID : `tiroir_credits_30`, nom « 30 crédits IA », prix 4,99 €, statut
   **Actif**.
3. Même chose pour `tiroir_credits_80` (9,99 €).

## 3. RevenueCat

1. **Products** : importer ou ajouter `tiroir_credits_30` et
   `tiroir_credits_80`, pour l'App Store et pour Google Play.
2. **Offerings** → nouvelle offre d'identifiant **`credits`** (exactement),
   avec deux packages personnalisés : l'un avec les deux produits 30,
   l'autre avec les deux produits 80. Ne pas la mettre « current » :
   l'offre courante reste celle de l'abonnement.
3. Le webhook existant (`revenuecat-webhook`) reçoit déjà les événements :
   rien à changer côté RevenueCat.

## 4. Vérifier

1. Sur un iPhone en TestFlight (compte Sandbox), ouvrir l'écran Premium :
   la section « Ou des crédits IA, sans abonnement » affiche les deux
   packs avec leur prix.
2. Acheter le petit pack : « 30 crédits arrivent sur votre compte ».
3. Dans Supabase, `ai_credit_ledger` contient une ligne `purchase` de 30.
4. Rejouer l'événement depuis RevenueCat : aucune ligne de plus.

Le nouveau Premium à 49,99 € (marche 4) se crée de la même façon, comme
nouvel abonnement, en gardant l'ancien pour les abonnés actuels.
