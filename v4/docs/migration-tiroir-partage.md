# Migration vers le Tiroir partagé

Ce qui, dans le schéma et le code V2, suppose « un utilisateur = un Tiroir
privé », et comment le lever sans casser le web ni l'app en production.

## Ce qui bloque aujourd'hui

| Où | Hypothèse V2 | Effet si un Tiroir devient partageable |
| --- | --- | --- |
| `drawers` (`20260622214158_foundations.sql`) | `UNIQUE (user_id)` : un seul Tiroir par compte. | Pas bloquant pour partager *son* Tiroir ; bloquant pour en posséder plusieurs. |
| RLS de `drawers`, `collections`, `objects` | `auth.uid() = user_id` partout. | Un membre ne voit rien du Tiroir d'un autre. |
| FK composites `(collection_id, user_id)`, `(drawer_id, user_id)` | Collection et objet appartiennent au même compte que le Tiroir. | Un membre qui ajoute un objet dans le Tiroir d'un autre casse la contrainte. |
| `mobile/src/components/ui/CollectionPickerSheet.tsx:97`, `mobile/app/(app)/collections/index.tsx:101`, `mobile/app/(app)/index.tsx:124` | `from('drawers').select('id').single()` | **Casse l'app** dès que la RLS laisse voir plus d'un Tiroir : `.single()` renvoie une erreur. **Corrigé** (phase 2) par `fetchOwnDrawerId`, pour les versions à venir. |
| ~40 lectures sans filtre de propriétaire sur `objects`, `collections`, `object_images` (recherche, stats du profil, sélecteurs de collection, assistant, pages web…) | La RLS ne laisse voir que ses propres lignes. | Si la RLS s'ouvre aux membres, les objets d'un Tiroir partagé se mêlent à ceux de l'utilisateur partout : recherche, compteurs, quotas affichés. |
| `supabase/functions/delete-account/index.ts:81` | Supprime les Tiroirs par `user_id`. | À revoir : que deviennent les membres d'un Tiroir supprimé ? |
| `objects.status = 'loaned'` | Le prêt est un statut, sans emprunteur ni échéance. | Reste valable ; un prêt V4.0 le met à jour. |

## Plan par phases

Chaque phase est déployable seule et laisse la V2 fonctionner à l'identique.

### Phase 0 — chantier isolé (ce commit)
Docs, brouillons SQL non appliqués, logique métier pure. Aucun effet.

### Phase 1 — trousseau, serrure et lecture dédiée (brouillon `0001`, prêt pour la preprod)
Purement additif ; **aucune** policy existante n'est modifiée.
- Table `drawer_members` (rôles `owner` / `editor` / `viewer`, expiration
  possible), remplie avec un `owner` par Tiroir existant et tenue à jour par
  un trigger sur `drawers`.
- Colonne `drawers.serrure` (`ferme` par défaut : rien ne change tant que le
  propriétaire n'ouvre pas).
- Invitations par lien à usage unique (`drawer_invites`) : pas de recherche de
  compte par e-mail, qui révélerait qui est inscrit.
- Fonctions, seule porte d'entrée vers les données partagées :
  `drawer_can` (miroir de `domain/serrure.ts`), `list_my_drawers`,
  `list_drawer_collections`, `list_drawer_objects`, `list_drawer_members`,
  `set_drawer_serrure`, `create_drawer_invite`, `revoke_drawer_invite`,
  `accept_drawer_invite`, `remove_drawer_member`.
- Tests : `supabase/tests/run.sh` (45 cas, sur une base jetable).

Reste à faire avant les écrans : les photos. Le bucket est privé et ses
policies ne laissent lire que son propre dossier ; il faudra une fonction
serveur qui signe les URL après avoir vérifié `drawer_can`.

Validation : coller `0001` dans l'éditeur SQL de la **preprod**, vérifier que
le web (preprod NAS) et l'app pointée sur la preprod se comportent exactement
comme avant, puis rejouer les scénarios des tests à la main.

### Phase 2 — préparer les clients (fait pour l'app)
- ✅ Les trois `from('drawers').select('id').single()` sont remplacés par
  `fetchOwnDrawerId` (`mobile/src/features/collections/ownDrawer.ts`), qui
  filtre sur le propriétaire.
- Publier cette version de l'app **et attendre qu'elle soit adoptée** : les
  anciennes versions installées gardent le `.single()`.

### Phase 3 — ouverture de la lecture, par une porte dédiée
Constat de la phase 2 : une quarantaine de lectures de l'app et du web
comptent sur la RLS pour ne renvoyer que les données de l'utilisateur. Ouvrir
les policies `SELECT` existantes aux membres ferait apparaître les objets
partagés dans la recherche, les statistiques ou les sélecteurs — y compris
dans les versions déjà installées, qu'on ne peut plus corriger.

On ne touche donc **pas** aux policies de `drawers`, `collections`, `objects` :
- la lecture partagée passe par des RPC dédiées (par exemple
  `list_shared_drawers()`, `list_drawer_objects(p_drawer_id)`), en
  `SECURITY DEFINER`, qui vérifient `is_drawer_member` et la serrure ;
- seuls les nouveaux écrans « Tiroir partagé » les appellent ;
- les anciennes versions de l'app ne voient rien de nouveau, et le
  correctif `.single()` devient une sécurité de plus plutôt qu'un prérequis.
- Toujours aucune écriture partagée.

### Phase 4 — écriture partagée et prêts
- Revoir les FK composites (`user_id` = auteur, plus propriétaire).
- RPC d'écriture pour les `editor`.
- Brouillon `0002` : prêts d'objets.

## Garde-fous

- Un brouillon passe de `v4/supabase/drafts/` à `supabase/migrations/` seulement
  après validation en preprod, renommé avec un horodatage.
- Les types de `mobile/src/types/database.ts` ne sont mis à jour qu'à la phase
  où le client lit réellement les nouvelles tables.
