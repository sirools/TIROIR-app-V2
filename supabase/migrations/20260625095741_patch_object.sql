-- ================================================================
-- 20260625095741_patch_object.sql
-- patch_object : édition complète d'une fiche objet (titre, description,
-- emplacement, collection, statut, attributs)
-- ================================================================

CREATE OR REPLACE FUNCTION public.patch_object(
  p_object_id     UUID,
  p_title         TEXT,
  p_description   TEXT DEFAULT NULL,
  p_location_note TEXT DEFAULT NULL,
  p_collection_id UUID DEFAULT NULL,
  p_status        TEXT DEFAULT 'owned',
  p_attributes    JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF NULLIF(trim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Le titre ne peut pas être vide';
  END IF;

  IF p_status NOT IN ('owned', 'stored', 'loaned', 'sold', 'given', 'lost') THEN
    RAISE EXCEPTION 'Statut invalide : %', p_status;
  END IF;

  IF NOT public.is_flat_json_object(COALESCE(p_attributes, '{}'::jsonb)) THEN
    RAISE EXCEPTION 'Les attributs doivent être un objet JSON plat';
  END IF;

  IF p_collection_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.collections
      WHERE id = p_collection_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Collection introuvable ou accès refusé (id: %)', p_collection_id;
    END IF;
  END IF;

  UPDATE public.objects
  SET
    title         = trim(p_title),
    description   = NULLIF(trim(COALESCE(p_description, '')), ''),
    location_note = NULLIF(trim(COALESCE(p_location_note, '')), ''),
    collection_id = p_collection_id,
    status        = p_status,
    attributes    = COALESCE(p_attributes, '{}'::jsonb)
  WHERE id = p_object_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.patch_object FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.patch_object TO authenticated;
