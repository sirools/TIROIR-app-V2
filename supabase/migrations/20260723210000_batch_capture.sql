-- ================================================================
-- 20260723210000_batch_capture.sql
-- Ajout multiple d'objets (« mode rafale ») — socle base.
--
-- Un lot regroupe N drafts partageant un batch_id. Chaque draft
-- reste un objet à part entière : le pipeline d'analyse, les
-- quotas et confirm_draft() sont réutilisés tels quels.
--
-- batch_position fige l'ordre de saisie (ordre de prise de vue ou
-- de sélection) pour que l'écran de review reste stable même après
-- un rechargement — les drafts d'un lot partagent le même created_at.
--
-- Purement additif : aucun chemin existant n'est modifié.
-- ================================================================

-- ── Colonnes de lot sur ai_drafts ────────────────────────────────

ALTER TABLE public.ai_drafts
  ADD COLUMN batch_id       UUID,
  ADD COLUMN batch_position INTEGER CHECK (batch_position IS NULL OR batch_position >= 0);

CREATE INDEX ai_drafts_batch_id_idx
  ON public.ai_drafts (batch_id, batch_position)
  WHERE batch_id IS NOT NULL;

-- ── begin_batch_capture : ouvre un lot de N drafts ───────────────
-- Retourne les drafts dans l'ordre de saisie. Le client associe
-- image[i] au draft de batch_position = i.

CREATE OR REPLACE FUNCTION public.begin_batch_capture(p_size INTEGER)
RETURNS TABLE(batch_id UUID, draft_id UUID, batch_position INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_batch_id UUID := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  -- Garde-fou dur, indépendant des plafonds produit (app_settings),
  -- qui eux sont appliqués côté client à l'entrée du mode.
  IF p_size IS NULL OR p_size < 1 OR p_size > 100 THEN
    RAISE EXCEPTION 'BATCH_SIZE_INVALID: taille de lot invalide (reçu: %)', p_size;
  END IF;

  RETURN QUERY
  WITH inserted AS (
    INSERT INTO public.ai_drafts (user_id, proposed_data, status, batch_id, batch_position)
    SELECT auth.uid(), '{}'::jsonb, 'uploading', v_batch_id, g.i - 1
      FROM generate_series(1, p_size) AS g(i)
    RETURNING id, ai_drafts.batch_position
  )
  SELECT v_batch_id, ins.id, ins.batch_position
    FROM inserted ins
   ORDER BY ins.batch_position;
END;
$$;

-- ── confirm_batch : finalise un lot, draft par draft ─────────────
-- Chaque draft est confirmé dans sa propre sous-transaction : un
-- échec (quota objets atteint, draft expiré) n'annule pas les
-- objets déjà créés. Le client reçoit le détail ligne par ligne.
--
-- Les drafts dont l'analyse a échoué (status <> 'pending') sont
-- ignorés silencieusement — ils n'ont rien à confirmer.

CREATE OR REPLACE FUNCTION public.confirm_batch(
  p_batch_id      UUID,
  p_collection_id UUID DEFAULT NULL
)
RETURNS TABLE(draft_id UUID, object_id UUID, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_draft_id UUID;
  v_obj_id   UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF p_batch_id IS NULL THEN
    RAISE EXCEPTION 'BATCH_ID_REQUIRED: identifiant de lot manquant';
  END IF;

  FOR v_draft_id IN
    SELECT d.id
      FROM public.ai_drafts d
     WHERE d.batch_id = p_batch_id
       AND d.user_id  = auth.uid()
       AND d.status   = 'pending'
     ORDER BY d.batch_position, d.id
  LOOP
    BEGIN
      v_obj_id := public.confirm_draft(v_draft_id, p_collection_id);

      draft_id      := v_draft_id;
      object_id     := v_obj_id;
      error_message := NULL;
    EXCEPTION WHEN OTHERS THEN
      draft_id      := v_draft_id;
      object_id     := NULL;
      error_message := SQLERRM;
    END;

    RETURN NEXT;
  END LOOP;
END;
$$;

-- ── Permissions (cohérent avec security_hardening) ───────────────

REVOKE EXECUTE ON FUNCTION public.begin_batch_capture(INTEGER)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_batch(UUID, UUID)     FROM PUBLIC, anon;

GRANT  EXECUTE ON FUNCTION public.begin_batch_capture(INTEGER)  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_batch(UUID, UUID)     TO authenticated;
