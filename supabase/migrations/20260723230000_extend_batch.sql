-- ================================================================
-- 20260723230000_extend_batch.sql
-- Allonge un lot déjà ouvert (bouton « Ajouter d'autres objets »
-- depuis l'écran de review).
--
-- begin_batch_capture() ouvre toujours un nouveau batch_id : il faut
-- une entrée distincte pour rattacher des drafts à un lot existant,
-- en continuant la numérotation batch_position.
-- ================================================================

CREATE OR REPLACE FUNCTION public.extend_batch_capture(
  p_batch_id UUID,
  p_size     INTEGER
)
RETURNS TABLE(batch_id UUID, draft_id UUID, batch_position INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_offset INTEGER;
  v_total  INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF p_size IS NULL OR p_size < 1 THEN
    RAISE EXCEPTION 'BATCH_SIZE_INVALID: taille invalide (reçu: %)', p_size;
  END IF;

  -- Le lot doit exister et appartenir à l'appelant.
  SELECT count(*), COALESCE(MAX(d.batch_position), -1) + 1
    INTO v_total, v_offset
    FROM public.ai_drafts d
   WHERE d.batch_id = p_batch_id
     AND d.user_id  = auth.uid();

  IF v_total = 0 THEN
    RAISE EXCEPTION 'BATCH_NOT_FOUND: lot introuvable (id: %)', p_batch_id;
  END IF;

  -- Même garde-fou dur que begin_batch_capture, appliqué au total.
  IF v_total + p_size > 100 THEN
    RAISE EXCEPTION
      'BATCH_SIZE_INVALID: un lot ne peut dépasser 100 objets (déjà %, demandé %)',
      v_total, p_size;
  END IF;

  RETURN QUERY
  WITH inserted AS (
    INSERT INTO public.ai_drafts (user_id, proposed_data, status, batch_id, batch_position)
    SELECT auth.uid(), '{}'::jsonb, 'uploading', p_batch_id, v_offset + g.i - 1
      FROM generate_series(1, p_size) AS g(i)
    RETURNING id, ai_drafts.batch_position
  )
  SELECT p_batch_id, ins.id, ins.batch_position
    FROM inserted ins
   ORDER BY ins.batch_position;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.extend_batch_capture(UUID, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.extend_batch_capture(UUID, INTEGER) TO authenticated;
