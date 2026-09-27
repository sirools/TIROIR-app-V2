# Suggestions sur une collection partagée — étape 1 (web)

Depuis un lien de partage, un destinataire **suggère** un objet au
propriétaire ; le propriétaire **trie** les suggestions par glissement
(droite = garder, gauche = écarter), avec annulation.

Branche : `feature/v4-suggestions-web`. Rien n'est fusionné dans `main`.

## Ce qui a été fait

| Demande | Réalisation |
| --- | --- |
| Statut d'un objet `owned` / `idea` / `suggested` | `owned` = la table `objects`, inchangée. `idea` et `suggested` = nouvelle table `collection_wishes` (`status` : `suggested`, `idea`, `dismissed`). Type TypeScript `ObjectKind` dans `web/lib/suggestions.ts`. |
| Objets existants en `owned`, migration non destructive | Aucune ligne de `objects` n'est modifiée ni déplacée : tout ce qui y est est « owned » par construction. |
| Offres rattachées à une idée | Table `wish_offers` (url, prix, devise, marchand, image, date de relevé, disponibilité, neuf/occasion, source). Vide pour l'instant. |
| Auteur d'une suggestion | `collection_wishes.suggested_by` → prénom (premier mot de `display_name`), nom affiché et photo (`avatar_path`). |
| Drapeau par collection | `collections.suggestions_enabled`, `false` par défaut. Réglable par le propriétaire sur la page de son partage. |
| Trois états visuels dans la grille | Carte normale / carte fantôme « Idée » (pointillé, estompée) / carte fantôme « Suggestion » + avatar et prénom de l'auteur. Pas d'onglet à part. |
| Bouton « + » côté destinataire | « Suggérer un objet » : nom, lien et prix optionnels. Visible seulement si la collection accepte les suggestions. |
| Visiteur sans compte | `SignupModalStub` (marqué `TODO(v4-suggestions)`) : explique, renvoie vers `/login?next=…`. |
| Tri façon Tinder | Une carte à la fois : glisser, boutons Garder / Écarter, flèches ← →, « Annuler le dernier choix » (et Ctrl+Z). N'apparaît que s'il reste une suggestion en attente. |

### Pourquoi une table à part plutôt qu'une colonne sur `objects`

Les versions déjà installées de l'app lisent `objects` sans filtre :
recherche, compteurs, plafond d'objets, exports, statistiques (voir
`migration-tiroir-partage.md`). Une idée ou une suggestion stockée là y
apparaîtrait comme un objet possédé, sans correctif possible. La future
conversion « Je l'ai acheté » créera le vrai objet dans `objects`.

### Lien de partage → collection

Un lien V2 n'est qu'une liste d'objets. Sa collection est :
1. `share_links.collection_id` s'il est renseigné (nouvelle colonne, vide
   pour tous les liens existants) ;
2. sinon, la collection de **tous** ses objets si elle est unique.

Un lien qui mélange plusieurs collections, ou contient un objet hors
collection, n'a pas de collection : pas de suggestions, page inchangée.
Règle unique, en SQL : `share_link_collection_id()`.

### Qui voit quoi

| | Idées | Suggestions en attente | Écartées |
| --- | --- | --- | --- |
| Propriétaire (connecté) | oui | toutes, avec auteur | non |
| Visiteur connecté, suggestions activées | oui | les siennes | non |
| Visiteur, suggestions désactivées | non | non | non |

### Sécurité

- Écriture uniquement par fonctions SQL ; aucune policy d'écriture sur les
  nouvelles tables. Lecture directe réservée au propriétaire (RLS).
- `create_collection_suggestion` n'est exécutable **que** par la clé
  service : le serveur web vérifie d'abord la session (`auth.getUser()`) et,
  pour un lien protégé, le mot de passe.
- **Cookie de partage signé.** Le cookie posé après le mot de passe valait
  `${horodatage}.ok` : n'importe qui pouvait le fabriquer. Il est désormais
  `${horodatage}.${hmac}.ok` (clé `SHARE_COOKIE_SECRET`, à défaut la clé
  service). La **lecture** accepte toujours l'ancien format (aucun
  changement pour les visiteurs actuels) ; l'**écriture** exige la signature.
  Corriger aussi la lecture fermerait la faille, mais changerait le
  comportement existant : décision à prendre séparément.
- Garde-fous : nom ≤ 120 caractères, lien `http(s)` uniquement, prix entre 0
  et 10 M, 50 suggestions en attente au plus par auteur et par collection.
- `/login?next=` n'accepte qu'un chemin interne (pas `//hôte` ni `/\hôte`).

## Fichiers

```
v4/supabase/drafts/0003_collection_suggestions.sql   schéma + fonctions (NON appliqué)
v4/supabase/tests/stub_0003.sql, 0003_*.test.sql     42 tests SQL (run.sh)
v4/e2e/suggestions/                                  banc e2e local (Playwright)
web/lib/suggestions.ts                               validation, tri, annulation (pur)
web/lib/shareSuggestions.ts                          lecture serveur, tolérante
web/lib/shareCookieSignature.ts                      cookie signé (serveur)
web/pages/api/shares/[token]/suggestions.ts          POST : créer une suggestion
web/pages/api/shares/[token]/verify.ts               pose désormais le cookie signé
web/pages/s/[token].tsx                              intégration dans la page de partage
web/pages/login.tsx                                  ?next= (retour au partage)
web/components/share/                                WishCard, AuthorAvatar, SuggestModal,
                                                     SignupModalStub, SuggestionTriage,
                                                     SuggestionsToggle
```

L'app mobile, les edge functions et `supabase/migrations/` ne sont pas touchés.

## Protocole de test

### 1. Automatique, sans aucune base réelle

```bash
# Règles SQL — base Postgres VIDE et jetable (45 tests 0001 + 42 tests 0003)
./v4/supabase/tests/run.sh "postgresql://postgres@localhost:5432/tiroir_v4_test"

# Logique web (20 tests)
cd web && npx vitest run __tests__/suggestions.test.ts __tests__/shareCookieSignature.test.ts

# Bout en bout : Postgres jetable + PostgREST + faux Supabase + Playwright
./v4/e2e/suggestions/run.sh "postgresql://postgres@localhost:5432/tiroir_e2e" /chemin/postgrest
```

Le banc e2e joue deux phases sur la même base :
- **avant** le brouillon (4 vérifications) : la page est identique à
  aujourd'hui, pas de bouton, pas de réglage ;
- **après** (28 vérifications) : réglage désactivé par défaut, visiteur
  sans compte → stub, Bob et Chloé suggèrent, isolement entre visiteurs,
  tri par glissement / bouton / clavier, annulation, lien protégé, ancien
  cookie refusé en écriture, désactivation → retour à l'identique.

Captures dans `v4/e2e/suggestions/shots/`.

> Le banc n'utilise pas de vrai Supabase : l'auth et le stockage sont
> simulés (`fake-supabase.mjs`). Il valide le code web et le SQL, pas la
> configuration d'un projet Supabase : c'est le rôle de l'étape 3.

### 2. Supabase local (Docker)

Sur une base locale qui a déjà les 71 migrations (`supabase start`) :

1. `psql "$LOCAL_DB_URL" -f v4/supabase/drafts/0003_collection_suggestions.sql`
2. Rejouer le brouillon une seconde fois : aucune erreur (idempotent).
3. Vérifier que rien n'a bougé :
   ```sql
   SELECT count(*) FROM objects;                                 -- identique à avant
   SELECT count(*) FROM collections WHERE suggestions_enabled;   -- 0
   SELECT count(*) FROM share_links WHERE collection_id IS NOT NULL; -- 0
   ```
4. Lancer le web sur ce Supabase local (`cd web && npm run dev`) et dérouler
   le scénario manuel de l'étape 3.
5. Ouvrir l'app mobile pointée sur ce Supabase local : liste, recherche,
   compteurs et quotas identiques avant et après suggestions.

### 3. Preprod (NAS + Supabase de preprod)

**Avant** d'appliquer le brouillon :
1. Déployer la branche : `git checkout feature/v4-suggestions-web && cd preprod && ./deploy.sh clementougier@192.168.1.23`.
2. Vérifier que tout se comporte comme avant (le code tolère l'absence du
   schéma) : `/s/<jeton>` en clair et protégé, export CSV/PDF, `/mes-partages`.
3. Ressaisir le mot de passe d'un partage protégé : ça marche comme avant.

**Appliquer** le brouillon : vérifier que la CLI et le dashboard pointent sur
le projet de **preprod**, puis coller `0003_collection_suggestions.sql` dans
l'éditeur SQL. Optionnel : ajouter `SHARE_COOKIE_SECRET` (`openssl rand -hex 32`)
dans `.env.preprod` et redéployer.

**Scénario manuel** (trois comptes : A propriétaire, B et C visiteurs) :

| # | Qui | Action | Attendu |
| --- | --- | --- | --- |
| 1 | A (app) | Partager toute une collection | Lien créé comme avant |
| 2 | A (web) | Ouvrir `/s/<jeton>` connecté | Réglage « Suggestions désactivées », pas de module de tri |
| 3 | Anonyme | Ouvrir le lien | Identique à avant, pas de bouton + |
| 4 | A | Activer les suggestions | L'interrupteur passe à l'orange |
| 5 | Anonyme | Recharger, cliquer « Suggérer un objet » | Modale « Crée ton compte Tiroir » (stub) |
| 6 | B | « J'ai déjà un compte » → connexion | Retour sur le partage |
| 7 | B | Suggérer « Couteau », lien `www.exemple.fr/x`, prix `89,90` | Carte fantôme « Suggestion » avec son prénom |
| 8 | C | Ouvrir le lien connecté | Ne voit pas la suggestion de B ; peut suggérer |
| 9 | A | Recharger | Module « Suggestions à trier (2) », cartes fantômes avec auteur et photo |
| 10 | A | Glisser à droite (souris et doigt sur mobile) | Carte suivante ; « Couteau » devient « Idée » |
| 11 | A | « Écarter » puis « Annuler le dernier choix » | La suggestion revient en tête |
| 12 | A | Tout trier, recharger | Module disparu ; idées en pointillé |
| 13 | B | Recharger | Voit les idées, plus les suggestions écartées |
| 14 | B | Lien protégé : mot de passe puis + | Formulaire direct, suggestion créée |
| 15 | A | Désactiver les suggestions | Visiteurs : page identique à l'étape 3 |
| 16 | A (app) | Parcourir collection, recherche, statistiques | Aucune idée ni suggestion n'apparaît |

**Non-régression prod** : le brouillon n'est jamais appliqué à la prod à
cette étape, et `main` ne reçoit rien. Le code web déployé en prod sans le
schéma se comporterait comme aujourd'hui (vérifié par la phase « avant » du
banc e2e), mais il n'y part pas avant validation.

## Hors périmètre (non codé)

API marchandes, inscription complète dans la modale, notifications au
propriétaire, « Je l'ai acheté », app iOS, renseignement de
`share_links.collection_id` à la création d'un partage (edge function
`create-share-link` et app mobile).
