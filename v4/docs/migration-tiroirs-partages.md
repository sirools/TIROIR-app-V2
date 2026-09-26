# Migration vers des Tiroirs partagés

Ce qui, dans le schéma et le code V2, suppose « un utilisateur = un Tiroir
privé », et comment le lever sans casser le web ni l'app en production.

## Ce qui bloque aujourd'hui

| Où | Hypothèse V2 | Effet si un Tiroir devient partageable |
| --- | --- | --- |
| `drawers` (`20260622214158_foundations.sql`) | `UNIQUE (user_id)` : un seul Tiroir par compte. | Pas bloquant pour partager *son* Tiroir ; bloquant pour en posséder plusieurs. |
| RLS de `drawers`, `collections`, `objects` | `auth.uid() = user_id` partout. | Un membre ne voit rien du Tiroir d'un autre. |
| FK composites `(collection_id, user_id)`, `(drawer_id, user_id)` | Collection et objet appartiennent au même compte que le Tiroir. | Un membre qui ajoute un objet dans le Tiroir d'un autre casse la contrainte. |
| `mobile/src/components/ui/CollectionPickerSheet.tsx:97`, `mobile/app/(app)/collections/index.tsx:101`, `mobile/app/(app)/index.tsx:124` | `from('drawers').select('id').single()` | **Casse l'app** dès que la RLS laisse voir plus d'un Tiroir : `.single()` renvoie une erreur. |
| `supabase/functions/delete-account/index.ts:81` | Supprime les Tiroirs par `user_id`. | À revoir : que deviennent les membres d'un Tiroir supprimé ? |
| `objects.status = 'loaned'` | Le prêt est un statut, sans emprunteur ni échéance. | Reste valable ; un prêt V4.0 le met à jour. |

## Plan par phases

Chaque phase est déployable seule et laisse la V2 fonctionner à l'identique.

### Phase 0 — chantier isolé (ce commit)
Docs, brouillons SQL non appliqués, logique métier pure. Aucun effet.

### Phase 1 — additif pur (brouillon `0001`)
- Table `drawer_members` (rôles `owner` / `editor` / `viewer`), remplie avec un
  `owner` par Tiroir existant, et tenue à jour par un trigger sur `drawers`.
- Colonne `drawers.serrure` (`ferme` par défaut).
- **Aucune** policy existante modifiée : les membres non propriétaires ne voient
  encore rien. Le web et l'app ne lisent pas ces nouveautés.

Validation : rejouer sur le Supabase de preprod, vérifier que le web (preprod
NAS) et l'app pointée sur la preprod se comportent exactement comme avant.

### Phase 2 — préparer les clients (code web + app, PR séparée)
- Remplacer les `from('drawers').select('id').single()` par une lecture
  explicite du Tiroir de l'utilisateur (`.eq('user_id', user.id)`), avant toute
  ouverture de la RLS.
- Publier cette version de l'app **et attendre qu'elle soit adoptée** : les
  anciennes versions installées gardent le `.single()`.

### Phase 3 — ouverture de la lecture
- Policies `SELECT` supplémentaires sur `drawers`, `collections`, `objects`
  pour les membres (`is_drawer_member(drawer_id)`), derrière un feature flag.
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
