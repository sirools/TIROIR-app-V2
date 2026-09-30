# V4 — prochaines étapes (avec le Mac)

État au 29 septembre 2026 : **les suggestions (étape 1) sont en prod.** Le
code web est dans `main` (PR #9, déployé sur `tiroir.app`), le SQL a été
appliqué en prod le 28/09 et sa migration est rangée dans `main`
(`supabase/migrations/20260928120000_collection_suggestions.sql`). L'étape 2
(réglage par partage, objets de son Tiroir, brouillon 0004) attend sur
`feature/v4-suggestions-ajouts`.

## 0. Aligner l'historique de la prod (≈ 2 min, une fois)

Appliqué depuis le SQL Editor, le SQL n'a pas été inscrit dans l'historique
de la base. Sans cette ligne, un `supabase db push` tenterait de le rejouer
(sans dégât : tout y est protégé, mais la règle de
`supabase/migrations/README.md` veut les mêmes versions des deux côtés).
Dans le SQL Editor **de prod** :

```sql
-- 1. Les suggestions sont bien là ?
SELECT to_regclass('public.collection_wishes') IS NOT NULL AS suggestions_en_prod;

-- 2. Si oui, inscrire la migration dans l'historique.
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260928120000', 'collection_suggestions')
ON CONFLICT (version) DO NOTHING;

-- 3. Vérifier : ces versions doivent être celles des fichiers de
--    supabase/migrations/, ni plus ni moins.
SELECT version, name FROM supabase_migrations.schema_migrations
 ORDER BY version DESC LIMIT 5;
```

- [ ] Fait, et les 5 dernières versions correspondent aux derniers fichiers
      (`…_profile_avatar`, `…_profiles_update_columns`,
      `…_collection_suggestions`).

## 1. Preprod (≈ 20 min)

- [ ] `git fetch && git checkout feature/v4-suggestions-web && git pull`
- [ ] **Avant** le SQL : `cd preprod && ./deploy.sh clementougier@192.168.1.23`,
      puis vérifier que les partages s'affichent comme avant (en clair,
      protégé, export CSV/PDF, `/mes-partages`).
- [x] SQL appliqué **en prod** le 28/09 depuis l'iPhone (SQL Editor),
      résultat vérifié. Rangé dans `supabase/migrations/20260928120000_collection_suggestions.sql`.
- [x] Fusionner la PR #9 → déploiement Vercel de `tiroir.app`.
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

## 5. Fusion ou fission ? (29 septembre 2026)

Deux mondes : le Tiroir en ligne (web, app, base de prod) et le chantier
V4. La fusion est prévue par construction — chaque phase de
`migration-tiroir-partage.md` est additive et laisse la V2 intacte. Le
risque, c'est la **fission** : un chantier isolé trop longtemps diverge.

Points à surveiller :
- **Branches en attente** : `feature/v4-suggestions-web` et
  `feature/v4-suggestions-ajouts` ne sont pas dans `main` ; plus elles
  attendent, plus elles divergent.
- **Écart prod / dépôt** : *refermé le 29/09.* Les suggestions sont en
  prod et leur migration est dans `main` ; reste à inscrire la version dans
  l'historique de la base (§ 0).
- **Fiches Torix en double** (`v4/torix/` et le Lab) : tenu, un test casse
  si elles divergent.

Ordre recommandé :
1. ~~Fusionner `feature/v4-suggestions-web` dans `main`~~ — fait le 29/09.
2. Aligner l'historique de la prod (§ 0).
3. Puis chaque étape de la V4 : preprod → `main`, une à une — la
   prochaine est l'étape 2 des suggestions (`feature/v4-suggestions-ajouts`).

## 6. Étape 2 des suggestions, fil par fil (29 septembre 2026)

La branche `feature/v4-suggestions-ajouts` faisait tout d'un coup (base,
fonction serveur, site, app). Elle est reprise en cinq fils, chacun vérifié
avant le suivant :

1. **Brouillon 0004, additif** — `v4/supabase/drafts/0004_*`. La nouvelle
   porte d'entrée s'appelle `create_share_suggestion` ; l'ancienne
   (`create_collection_suggestion`) et le drapeau par collection restent,
   pour que le site en ligne marche tel quel. 16 tests SQL.
2. **0004 sur la preprod**, puis vérification.
3. **`create-share-link`** retient la collection et l'option d'ajouts.
4. **App** : « Autoriser les ajouts » sur un partage.
5. **Site** : tuile « + », objets de son Tiroir, réglage lu sur le partage.
   Le code de la branche appelle encore `create_collection_suggestion` à
   sept arguments : à passer sur `create_share_suggestion` en reprenant ce
   fil.

Puis **0005, nettoyage** : retirer `create_collection_suggestion` et
`collections.suggestions_enabled`, une fois le fil 5 en ligne. Pendant la
transition, un réglage changé côté site ancien (par collection) n'est pas
recopié sur le partage : c'est pourquoi le fil 5 suit de près le fil 4.

## 7. Mode coffre — ce soir, avec l'ordinateur (29 septembre 2026)

Plan et ordre de travail : `docs/mode-coffre.md` (brouillon SQL 0005,
refus serveur dans les fonctions IA et le partage, interrupteur et
cadenas web puis mobile, build iOS et Android).

## 8. Vendre depuis son Tiroir (29 septembre 2026)

Après le mode coffre. Plan : `docs/vente.md` (étape 1 « Vendre » prépare
l'annonce ; étape 2 paiement intégré et commission, après l'avocat).

## 9. Premier Tiroir partagé de test (29 septembre 2026)

Décision du fondateur : le trousseau de la V4 se teste d'abord à trois,
dans l'ordre :

| Clé | Qui | Rôle (`drawer_members`) |
| --- | --- | --- |
| 1 | Clément, fondateur | `owner` |
| 2 | Stéphane | `editor` ou `viewer`, à choisir |
| 3 | Mélanie, styliste (profil « créatif organisé ») | `editor` ou `viewer`, à choisir |

Personne d'autre pour le moment. Serrure du Tiroir de test : « entrouvert ».
À faire le jour du test : que Stéphane et Mélanie aient chacun un compte
Tiroir, puis appliquer 0001 sur la preprod et leur remettre leur clé.
Ce ne sont que des clés de Tiroir : jamais d'accès au back-office, à Torix
ni à la clé des sauvegardes.

## 10. Contenants numérotés (30 septembre 2026)

Juste après le mode coffre. Une valise devient « Valise n° 3 » avec une
étiquette QR ; chaque objet sait de quel contenant il vient ; on vend un
contenant entier d'un coup. Plan : `docs/contenants.md`.
