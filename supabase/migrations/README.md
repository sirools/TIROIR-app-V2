# Migrations

Ce dossier doit pouvoir être **rejoué tel quel sur une base vierge** et
produire exactement le schéma de production. C'est ce qui rend possibles un
environnement de préproduction, une branche Supabase, ou une restauration.

## La règle

**Le nom du fichier commence par la version que la base a enregistrée**, pas
par un horodatage choisi à la main.

La production tient sa propre table d'historique,
`supabase_migrations.schema_migrations`, avec une ligne par migration
appliquée : sa `version`, son `name`, et le SQL exécuté. La CLI Supabase
compare **les versions**, pas les noms ni les contenus. Une version locale
qui ne correspond à aucune ligne distante est considérée comme non
appliquée — et un `supabase db push` tenterait de la rejouer.

## Ajouter une migration

Quand elle est appliquée via l'API ou le serveur MCP, c'est la base qui
génère la version (horodatage UTC du moment). Donc :

1. appliquer la migration ;
2. relire la version qu'elle a reçue :
   ```sql
   SELECT version, name FROM supabase_migrations.schema_migrations
    ORDER BY version DESC LIMIT 1;
   ```
3. nommer le fichier `<version>_<name>.sql`.

Avec la CLI (`supabase migration new`), la version est générée localement et
reprise telle quelle à l'application : rien à réaligner.

## Vérifier l'alignement à tout moment

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

L'ensemble des versions doit être **identique** à celui des préfixes de
fichiers de ce dossier. Ni plus, ni moins.

## Réconciliation du 2026-08-06

L'historique avait dérivé. Ce qui a été corrigé :

- **22 fichiers réalignés.** Toutes les migrations postérieures au
  2026-06-30 portaient un horodatage saisi à la main, différent de celui
  enregistré par la base. Les 24 premières étaient déjà alignées.
- **2 migrations reconstituées**, appliquées en production sans jamais avoir
  été redescendues dans le dépôt :
  `20260630203456_get_plan_limits_rpc` et
  `20260701233732_admin_infra_stats_fix_cast`. Rejouer ce dossier sur une
  base vierge produisait donc, jusqu'ici, un schéma différent de la prod.
- **Contenus vérifiés** : aucun fichier n'était plus court que le SQL
  réellement appliqué, sauf `20260622214917_composite_fk_indexes.sql` dont
  seuls des commentaires manquaient — les statements étaient identiques.

État après réconciliation : **48 fichiers, 48 lignes en base, mêmes versions.**
