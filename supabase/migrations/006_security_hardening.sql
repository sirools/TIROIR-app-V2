-- ================================================================
-- 006_security_hardening.sql
-- Deux corrections post-advisors :
--
-- 1. SET search_path sur les fonctions sans SECURITY DEFINER
--    (set_updated_at, is_flat_json_object, update_object_search_vector,
--     search_objects, search_objects_semantic)
--
-- 2. REVOKE EXECUTE FROM anon sur les RPCs SECURITY DEFINER
--    (Supabase ajoute des grants implicites même après REVOKE FROM PUBLIC)
-- ================================================================

-- ── 1. search_path fixe sur les fonctions utilitaires ─────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_flat_json_object(val JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    jsonb_typeof(val) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each(val) AS kv(k, v)
      WHERE jsonb_typeof(kv.v) IN ('object', 'array')
    )
$$;

CREATE OR REPLACE FUNCTION public.update_object_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.location_note, '') || ' ' ||
    coalesce((
      SELECT string_agg(v, ' ')
      FROM jsonb_each_text(NEW.attributes) AS t(k, v)
    ), '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_objects(
  p_query         TEXT,
  p_collection_id UUID    DEFAULT NULL,
  p_limit         INTEGER DEFAULT 20,
  p_offset        INTEGER DEFAULT 0
)
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  description   TEXT,
  location_note TEXT,
  status        TEXT,
  collection_id UUID,
  attributes    JSONB,
  rank          REAL
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.title,
    o.description,
    o.location_note,
    o.status,
    o.collection_id,
    o.attributes,
    ts_rank(o.search_vector, websearch_to_tsquery('simple', p_query))::REAL
  FROM public.objects o
  WHERE
    o.user_id = auth.uid()
    AND o.search_vector @@ websearch_to_tsquery('simple', p_query)
    AND (p_collection_id IS NULL OR o.collection_id = p_collection_id)
  ORDER BY ts_rank(o.search_vector, websearch_to_tsquery('simple', p_query)) DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

-- Maintenir le grant authenticated (CREATE OR REPLACE remet PUBLIC par défaut)
REVOKE EXECUTE ON FUNCTION public.search_objects FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.search_objects TO authenticated;

CREATE OR REPLACE FUNCTION public.search_objects_semantic(
  p_query_embedding extensions.vector(1536),
  p_threshold       FLOAT   DEFAULT 0.70,
  p_limit           INTEGER DEFAULT 10
)
RETURNS TABLE (
  id         UUID,
  title      TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.title,
    (1 - (o.embedding <=> p_query_embedding))::FLOAT
  FROM public.objects o
  WHERE
    o.user_id = auth.uid()
    AND o.embedding IS NOT NULL
    AND (1 - (o.embedding <=> p_query_embedding)) > p_threshold
  ORDER BY o.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_objects_semantic FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.search_objects_semantic TO authenticated;

-- ── 2. Révoquer anon sur les RPCs SECURITY DEFINER ───────────────
-- Ces fonctions nécessitent auth.uid() non-NULL et vérifient
-- l'appartenance en interne. L'accès anon est superflu et
-- constitue une surface d'attaque inutile.

REVOKE EXECUTE ON FUNCTION public.begin_draft_capture()           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_draft(UUID, UUID)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_change_proposal(UUID)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_draft(UUID)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_object(UUID)             FROM PUBLIC, anon;

-- S'assurer que authenticated a bien le grant (idempotent)
GRANT EXECUTE ON FUNCTION public.begin_draft_capture()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_draft(UUID, UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_change_proposal(UUID)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_draft(UUID)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_object(UUID)              TO authenticated;
