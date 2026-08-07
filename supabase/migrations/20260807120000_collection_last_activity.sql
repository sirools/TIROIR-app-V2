-- ================================================================
-- 20260807120000_collection_last_activity.sql
-- last_activity_at : la derniere fois qu'il s'est passe quelque chose
-- dans une collection, elle-meme OU l'un de ses objets.
--
-- Le tri « modifie recemment » ne peut pas se contenter de
-- collections.updated_at : renommer un objet, changer son statut ou son
-- prix ne touche pas la ligne de sa collection. Une collection ou l'on
-- travaille tous les jours resterait au fond de la liste.
--
-- Calcule a la lecture plutot que maintenu par un declencheur sur
-- objects. Un declencheur ecrirait dans collections a chaque modification
-- d'objet — amplification d'ecriture, verrou sur la ligne parente, et
-- deux sources de verite a garder d'accord. Le GREATEST se paie sur une
-- requete deja agregee, dans le meme balayage que le comptage.
--
-- Un objet qui QUITTE une collection fait aussi baisser la valeur, sans
-- rien de plus : le maximum est recalcule sur les objets restants.
--
-- Limite assumee : ajouter une photo ou un document a un objet ne touche
-- pas objects.updated_at (autres tables). Le titre, la description, le
-- statut, l'emplacement, les attributs, le prix et le rangement passent
-- tous par patch_object, donc par le declencheur set_objects_updated_at.
-- ================================================================

CREATE OR REPLACE FUNCTION public.list_collections_with_counts()
RETURNS TABLE(
  id               UUID,
  user_id          UUID,
  drawer_id        UUID,
  name             TEXT,
  description      TEXT,
  location         TEXT,
  cover_image_path TEXT,
  emoji            TEXT,
  icon_color       TEXT,
  pinned_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  object_count     INTEGER
)
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT
    c.id,
    c.user_id,
    c.drawer_id,
    c.name,
    c.description,
    c.location,
    c.cover_image_path,
    c.emoji,
    c.icon_color,
    c.pinned_at,
    c.created_at,
    c.updated_at,
    GREATEST(c.updated_at, COALESCE(o.last_object_at, c.updated_at)) AS last_activity_at,
    COALESCE(o.object_count, 0)::INTEGER
  FROM public.collections c
  LEFT JOIN (
    SELECT collection_id,
           COUNT(*)          AS object_count,
           MAX(updated_at)   AS last_object_at
      FROM public.objects
     WHERE collection_id IS NOT NULL
     GROUP BY collection_id
  ) o ON o.collection_id = c.id
  ORDER BY c.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_collections_with_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_collections_with_counts() TO authenticated;
