-- ================================================================
-- 20260702050000_search_objects_fuzzy.sql
-- search_objects (plein-texte, ET logique strict entre les mots)
-- rate les requêtes en langage naturel qui ne matchent pas
-- exactement le titre/attributs ("manteau fourrure blanc" ne
-- trouve pas "Manteau en fausse fourrure synthétique ivoire").
-- Ajoute une recherche floue par trigrammes (pg_trgm, déjà activé)
-- sur titre + description + attributs, en complément — utilisée
-- par l'assistant Tiroir pour proposer des objets proches plutôt
-- que de répondre "rien trouvé".
-- ================================================================

CREATE OR REPLACE FUNCTION public.search_objects_fuzzy(
  p_query TEXT,
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  description   TEXT,
  location_note TEXT,
  status        TEXT,
  collection_id UUID,
  attributes    JSONB,
  score         REAL
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id, o.title, o.description, o.location_note, o.status, o.collection_id, o.attributes,
    GREATEST(
      similarity(o.title, p_query),
      similarity(coalesce(o.description, ''), p_query),
      similarity(coalesce(o.attributes::text, ''), p_query)
    )::REAL AS score
  FROM public.objects o
  WHERE
    o.user_id = auth.uid()
    AND (
      similarity(o.title, p_query) > 0.1
      OR similarity(coalesce(o.description, ''), p_query) > 0.1
      OR similarity(coalesce(o.attributes::text, ''), p_query) > 0.1
    )
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_objects_fuzzy TO authenticated;

-- Index trigrammes pour garder la recherche floue rapide à l'échelle.
CREATE INDEX IF NOT EXISTS idx_objects_title_trgm ON public.objects USING gin (title extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_objects_description_trgm ON public.objects USING gin (description extensions.gin_trgm_ops);
