# V4 — prochaines étapes (avec le Mac)

État au 28 septembre 2026. Tout est sur la branche `feature/v4-suggestions-web`,
PR en brouillon, **rien n'est fusionné dans `main`**.

## 1. Preprod (≈ 20 min)

- [ ] `git fetch && git checkout feature/v4-suggestions-web && git pull`
- [ ] **Avant** le SQL : `cd preprod && ./deploy.sh clementougier@192.168.1.23`,
      puis vérifier que les partages s'affichent comme avant (en clair,
      protégé, export CSV/PDF, `/mes-partages`).
- [x] SQL appliqué **en prod** le 28/09 depuis l'iPhone (SQL Editor),
      résultat vérifié. Rangé dans `supabase/migrations/20260928120000_collection_suggestions.sql`.
- [ ] Fusionner la PR #9 → déploiement Vercel de `tiroir.app`.
- [ ] L'appliquer aussi sur le Supabase **de preprod** (même fichier).
- [ ] Dérouler le scénario manuel de `suggestions.md` (16 étapes, 3 comptes).
- [ ] Ouvrir l'app mobile pointée sur la preprod : collections, recherche,
      statistiques identiques (aucune idée ni suggestion n'y apparaît).

## 2. Mise à jour de la preprod sans le Mac (une fois)

- [ ] Créer un jeton GitHub fine-grained, lecture seule, limité au dépôt.
- [ ] Le déposer dans `/volume1/docker/tiroir-preprod/.github-token`
      (commande dans `preprod/README.md`).
- [ ] Tester : `./nas-update.sh feature/v4-suggestions-web` en SSH.

## 3. TestFlight sans le Mac (une fois)

- [ ] expo.dev → projet `sirools/tiroir-v2` → Project settings → GitHub :
      relier `sirools/TIROIR-app-V2`, dossier de base `mobile`.
- [ ] Vérifier la syntaxe de `mobile/.eas/workflows/testflight.yml` avec la
      doc EAS Workflows (écrite sans accès à la doc).
- [ ] Vérifier que la clé App Store Connect est connue d'EAS (`eas credentials`).
- [ ] Créer la branche `testflight` depuis la branche à publier : le build
      et l'envoi à TestFlight partent tout seuls. Le workflow n'existe que
      sur `feature/v4-suggestions-web` tant qu'elle n'est pas fusionnée :
      créer `testflight` depuis elle (le code mobile y est identique à `main`).

## 4. Décisions en attente

- Fermer aussi la faille du cookie de partage **en lecture** (aujourd'hui
  seule l'écriture exige le cookie signé) : les visiteurs actuels d'un
  partage protégé devraient ressaisir le mot de passe une fois.
- Enregistrer la collection d'un lien à sa création (`create-share-link` +
  app mobile) pour lever la limite « un lien = une seule collection ».
- Photo dans le formulaire de suggestion.
- Fusion dans `main` et passage du brouillon SQL dans `supabase/migrations/`,
  une fois la preprod validée.
