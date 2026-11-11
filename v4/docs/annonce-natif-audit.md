# « Préparer une annonce » dans l'app — audit du partage natif (11 novembre 2026)

Lecture seule de `mobile/` et de `supabase/` : aucun code natif modifié. La
version web est livrée sur la branche `claude/annonce-export`
(`web/lib/listing.ts`, `web/pages/s/[token]/annonces.tsx`). Ce document dit
où la brancher dans l'app et ce qu'il manque. Il prolonge l'étape 1 de
`vente.md`.

## En bref

- L'app peut reprendre la fonction sans migration ni Edge Function : les
  données et les points d'entrée existent. Compter **3 à 4 jours** pour le
  texte de l'annonce (copier, feuille de partage), **+2 jours** pour les
  photos en lot.
- Deux manques pour une annonce complète : **accessoires** et **état** n'ont
  pas de champ dédié. Ils se règlent sans migration (clés de `attributes`).
- Une anomalie sans rapport avec l'annonce, à traiter à part : l'écran de
  partage de l'app (`mobile/app/s/[token].tsx`) ne respecte pas le mot de
  passe ni l'archivage.

## 1. Le partage aujourd'hui

| Sujet | Comment c'est fait | Où |
| --- | --- | --- |
| Création du lien | Edge Function `create-share-link` : vérifie que les objets sont au compte, tire un jeton de 8 caractères, écrit `share_links` | `supabase/functions/create-share-link/index.ts` |
| Collection ou lien partiel | Un seul mécanisme : une liste d'objets (`share_links.object_ids`). « Toute la collection » = tout sélectionner. `collection_id` existe en base mais ni la fonction ni l'app ne le renseignent | `mobile/src/components/SharePanel.tsx:20-26` |
| Mot de passe | Empreinte SHA-256 dans `options.password_hash` ; vérifié par le site (cookie signé). Depuis l'app, on ne peut que le retirer | `create-share-link:36-42`, `web/pages/api/shares/[token]/verify.ts`, `ShareSettingsSheet.tsx:117-123` |
| Lecture seule | Tous les liens le sont. Seule écriture possible pour un destinataire : les suggestions de collection, sur le site | — |
| Champs exposés | `options.fields` (valeurs, emplacement, attributs, description, assurance), `allow_download`, `include_documents` | `SharePanel.tsx:259-312` |
| Expiration | 7, 30, 90 jours ou jamais → `expires_at` | `SharePanel.tsx:51-56` |
| Révocation | L'app **supprime** la ligne ; le site **archive** (`is_archived`), que l'app ignore | `mobile/app/(app)/shares.tsx:57-75`, `web/pages/mes-partages.tsx` |
| Remise du lien | `Clipboard.setStringAsync` (expo-clipboard) et `Share.share({ url, message })` de React Native | `SharePanel.tsx:235, 242` |
| Page vue par le destinataire | Le site, avec la clé service : `web/pages/s/[token].tsx` | — |

**Anomalie.** `mobile/app/s/[token].tsx` lit `share_links` puis `objects`
avec le client public. Il ne contrôle que `expires_at` : ni `is_archived`,
ni le mot de passe (un simple badge), ni `options.fields`, ni le compteur
de vues ; son bouton Télécharger n'a pas d'action. D'après les migrations
lues, la seule règle de lecture sur `objects` est « le propriétaire » : un
visiteur n'y verrait donc aucun objet. À confirmer sur la base réelle, puis
soit rediriger cet écran vers le site, soit le supprimer.

## 2. Où brancher « Préparer une annonce »

| Point d'entrée | Fichier | Geste |
| --- | --- | --- |
| Fiche objet, menu « ··· » | `mobile/app/(app)/objects/[id].tsx:3213-3222` (Modifier, Partager, Supprimer) | Ajouter « Préparer une annonce » sous Partager |
| Fiche objet, barre du bas | même fichier, l.3191-3205 (Partager, Supprimer) | Option : un troisième bouton, si la mesure montre de l'usage |
| Sélection multiple d'une collection | `mobile/app/(app)/collections/[id].tsx:1221-1245` (Statut, Groupe, Déplacer, Partager, Supprimer) | Ajouter « Annonces » ; la barre porte déjà cinq actions, prévoir un « Plus » |

Écran proposé : une feuille (comme `SharePanel`) avec les mêmes champs que
le site — titre, prix, catégorie suggérée, description — chacun avec
« Copier », plus « Tout copier » et « Partager… ».

**Partage système iOS / Android**

- Texte : `Clipboard.setStringAsync` et `Share.share({ message })`, déjà en
  place dans la fiche (`copyDescription`, l.2565-2570). Aucune bibliothèque
  à ajouter.
- Photos : rien n'existe. `Share.share` ne partage qu'un texte ou une
  adresse ; `expo-sharing` (un fichier à la fois) et `expo-media-library`
  ne sont pas installés. Deux voies :
  1. **Enregistrer dans la photothèque** (`expo-media-library`) : le
     vendeur les reprend ensuite dans l'app Leboncoin. Simple, mais une
     autorisation de plus et un nouveau build natif.
  2. **Feuille de partage à plusieurs images** : `react-native-share`
     (module natif, nouveau build). Meilleur geste sur iOS ; sur Android,
     Leboncoin n'accepte pas forcément les images reçues ainsi — à tester
     sur appareil avant de choisir.
- Les copies haute définition (`object_images.zoom_path`) sont déjà là pour
  les abonnés : ce sont elles qu'il faut exporter.

**Logique à partager.** `web/lib/listing.ts` est sans dépendance : le
recopier dans `mobile/src/features/objects/listing.ts`, comme
`quantity.ts` l'est déjà des deux côtés, avec le même fichier de tests.

**Palier.** L'app masque déjà des fonctions selon `profile.plan`
(`mobile/src/lib/plan.ts`, `isProPlan`). « Business » n'est pas une valeur
de `profiles.plan` (contrainte : free, premium, pro) : un membre Business
reçoit le palier Pro par son organisation. Tester `pro` non échu suffit
donc aujourd'hui ; côté web, `canPrepareListing` accepte aussi `business`
pour le jour où la valeur existera. Pour un interrupteur à distance,
ajouter un drapeau à la RPC `get_feature_flags()` (`useFeatureFlags.ts`).

## 3. Champs d'une annonce

| Champ | État | Où |
| --- | --- | --- |
| Titre | présent | `objects.title` |
| Description | présent | `objects.description` |
| Marque, modèle, dimensions | présents par convention, non garantis | `attributes.brand`, `.model`, `.dimensions` |
| État | **fragile** : clé libre `attributes.condition`, parfois « état » en français | lue par `estimate-value` l.85 |
| Accessoires | **manquant** : aucune clé recommandée, l'IA ne le remplit pas | — |
| Catégorie | `attributes.category` en texte libre ; **aucune correspondance avec les rubriques de Leboncoin** (le site la devine par mots-clés) | — |
| Poids | manquant ; utile seulement pour l'envoi | — |
| Prix | présent : `sale_price`, `sale_price_lot`, sinon `user_value`, `market_value` | montants unitaires, cf. `quantity.ts` |
| Quantité | présent | `objects.quantity` |
| Photos | présentes, ordonnées | `object_images.position`, `zoom_path` |
| Statut « en vente » | **manquant** : seul `sold` existe | prévu par `vente.md` |
| Texte d'annonce retouché | **non conservé** : sur le site, les retouches se perdent en quittant la page | — |
| Lieu de remise (ville) | manquant ; Leboncoin le demande à chaque annonce | — |

## 4. Recommandations

1. **Texte d'abord, photos ensuite.** Livrer la feuille « Préparer une
   annonce » avec copier et partage du texte : aucun module natif à
   ajouter.
2. **État et accessoires sans migration** : deux champs dans l'écran de
   modification, écrits dans `attributes.condition` (liste fermée : neuf,
   très bon état, bon état, état satisfaisant, pour pièces — à caler sur la liste
   de Leboncoin au moment de coder) et `attributes.accessories`. Demander à `describe-object` de
   proposer l'état : c'est une fonction IA, donc fiches de Torix à mettre à
   jour (`web/components/torix/knowledge.ts`).
3. **Mesurer avant d'aller plus loin** : un événement par annonce préparée
   et par copie, sur le site comme dans l'app. C'est le chiffre que
   `vente.md` attend pour décider de l'étape 2.
4. **Statut « en vente »** : à faire avec la mesure, pas avant — c'est une
   migration et un changement du cycle de vie.
5. **Corriger à part** l'écran `mobile/app/s/[token].tsx` (§ 1).

## 5. Estimation d'effort

| Lot | Contenu | Effort |
| --- | --- | --- |
| A | `listing.ts` porté dans l'app, feuille « Préparer une annonce » sur la fiche, copier par champ, tout copier, partage du texte, palier Pro, textes en six langues | 2 à 3 jours |
| B | Sélection multiple depuis une collection (liste d'annonces, une par objet) | 1 jour |
| C | Photos en lot : choix de la voie après test sur appareil, téléchargement des copies HD, autorisation, nouveau build iOS et Android | 2 jours |
| D | Champs État (liste fermée) et Accessoires dans l'écran de modification, repris par le site | 1 jour |
| E | Mesure (événements, ligne dans la page Marketing du back-office) | 0,5 jour |
| F | Statut « en vente » (migration, filtres, partage) | 2 à 3 jours, à décider après mesure |

A + B n'ajoutent aucun module natif. C impose un passage par TestFlight et le
Play Store.
