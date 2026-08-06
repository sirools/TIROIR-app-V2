-- ================================================================
-- 20260801093912_collections_pin_and_counts.sql
-- collections.pinned_at (épinglage) · list_collections_with_counts()
--
-- L'app comptait jusqu'ici les objets côté client, en chargeant tous
-- les collection_id de l'inventaire pour les agréger en JS. Ça ne tient
-- pas au-delà de quelques centaines d'objets, et le tri « par nombre
-- d'objets » en dépend directement : le comptage passe donc en base.
-- ================================================================

-- ── Épinglage ───────────────────────────────────────────────────
--
-- Horodatage plutôt que booléen : on obtient gratuitement l'ordre
-- entre collections épinglées (la dernière épinglée en tête), et
-- NULL = non épinglée permet un index partiel étroit.

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS collections_user_pinned_idx
  ON public.collections (user_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

-- ── Liste + compteurs ───────────────────────────────────────────
--
-- SECURITY INVOKER : les RLS de collections et objects s'appliquent
-- telles quelles, la fonction n'ouvre aucun accès supplémentaire.
-- Le tri final est laissé au client (préférence d'affichage locale) ;
-- l'ordre par défaut renvoyé est l'ordre d'ajout.

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
  object_count     INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
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
    COALESCE(o.object_count, 0)::INTEGER
  FROM public.collections c
  LEFT JOIN (
    SELECT collection_id, COUNT(*) AS object_count
      FROM public.objects
     WHERE collection_id IS NOT NULL
     GROUP BY collection_id
  ) o ON o.collection_id = c.id
  ORDER BY c.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_collections_with_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_collections_with_counts() TO authenticated;

-- ── Épingler / désépingler ──────────────────────────────────────
--
-- Une RPC plutôt qu'un UPDATE direct : le basculement doit être atomique
-- (lire puis écrire depuis le client ouvrirait une fenêtre de course sur
-- deux appareils), et l'appel reste lisible côté app.

CREATE OR REPLACE FUNCTION public.toggle_collection_pin(p_collection_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pinned_at TIMESTAMPTZ;
BEGIN
  UPDATE public.collections
     SET pinned_at = CASE WHEN pinned_at IS NULL THEN now() ELSE NULL END
   WHERE id = p_collection_id
  RETURNING pinned_at INTO v_pinned_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection introuvable';
  END IF;

  RETURN v_pinned_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_collection_pin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_collection_pin(UUID) TO authenticated;
