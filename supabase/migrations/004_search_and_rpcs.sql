-- ================================================================
-- 004_search_and_rpcs.sql
-- activity_log · indexes · begin_draft_capture · search_objects
-- search_objects_semantic · confirm_draft · confirm_change_proposal
-- reject_draft · delete_object
-- ================================================================

-- ── activity_log ──────────────────────────────────────────────────

CREATE TABLE public.activity_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_id  UUID        REFERENCES public.objects(id) ON DELETE SET NULL,
  action     TEXT        NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX activity_log_user_created_idx ON public.activity_log (user_id, created_at DESC);
CREATE INDEX activity_log_object_id_idx    ON public.activity_log (object_id);

CREATE POLICY "activity_log: select own"
  ON public.activity_log FOR SELECT
  USING (auth.uid() = user_id);

-- ── Indexes de recherche ──────────────────────────────────────────

CREATE INDEX objects_search_vector_gin_idx
  ON public.objects USING gin (search_vector);

CREATE INDEX objects_title_trgm_idx
  ON public.objects USING gin (title extensions.gin_trgm_ops);

CREATE INDEX objects_attributes_gin_idx
  ON public.objects USING gin (attributes);

CREATE INDEX objects_embedding_hnsw_idx
  ON public.objects USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

-- ── RPC : begin_draft_capture ─────────────────────────────────────
-- Point d'entrée du flux photo-avant-objet.
-- Crée un draft minimal (statut 'uploading') et retourne son id.
--
-- Flux :
--   begin_draft_capture()
--   → upload vers {user_id}/drafts/{draft_id}/{image_id}.ext
--   → chat-turn(draft_id, message) → status 'pending', proposed_data rempli
--   → confirm_draft(draft_id, collection_id)

CREATE OR REPLACE FUNCTION public.begin_draft_capture()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_draft_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  INSERT INTO public.ai_drafts (user_id, proposed_data, status)
  VALUES (auth.uid(), '{}'::jsonb, 'uploading')
  RETURNING id INTO v_draft_id;

  RETURN v_draft_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.begin_draft_capture() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.begin_draft_capture() TO authenticated;

-- ── RPC : search_objects ──────────────────────────────────────────

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

GRANT EXECUTE ON FUNCTION public.search_objects TO authenticated;

-- ── RPC : search_objects_semantic ─────────────────────────────────

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

GRANT EXECUTE ON FUNCTION public.search_objects_semantic TO authenticated;

-- ── RPC : confirm_draft ───────────────────────────────────────────
-- Accepte uniquement les drafts en statut 'pending' (proposed_data
-- rempli par chat-turn). Les drafts 'uploading' doivent d'abord être
-- traités par chat-turn.
--
-- Séquence :
--   1. Validation du draft et de la collection
--   2. Création de l'objet
--   3. Migration ai_draft_images → object_images (fichiers Storage inchangés)
--   4. Suppression des lignes ai_draft_images (référence unique dans object_images)
--   5. Passage du draft à 'confirmed'
--   6. Journal d'activité

CREATE OR REPLACE FUNCTION public.confirm_draft(
  p_draft_id      UUID,
  p_collection_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_draft   public.ai_drafts%ROWTYPE;
  v_data    JSONB;
  v_obj_id  UUID;
  v_min_pos INTEGER;
BEGIN
  SELECT * INTO v_draft
  FROM public.ai_drafts
  WHERE id = p_draft_id
    AND user_id = auth.uid()
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Draft introuvable, non traité par l''IA, ou déjà finalisé (id: %)',
      p_draft_id;
  END IF;

  IF v_draft.expires_at < now() THEN
    UPDATE public.ai_drafts
    SET status = 'expired', updated_at = now()
    WHERE id = p_draft_id;
    RAISE EXCEPTION 'Ce draft a expiré (id: %)', p_draft_id;
  END IF;

  IF p_collection_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.collections
      WHERE id = p_collection_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION
        'Collection introuvable ou accès refusé (id: %)', p_collection_id;
    END IF;
  END IF;

  v_data := v_draft.proposed_data;

  -- Valider que les attributs proposés sont un objet JSON plat
  IF NOT public.is_flat_json_object(COALESCE(v_data->'attributes', '{}'::jsonb)) THEN
    RAISE EXCEPTION
      'Les attributs proposés doivent être un objet JSON plat '
      '(pas d''objets ni de tableaux imbriqués)';
  END IF;

  -- 1. Créer l'objet
  INSERT INTO public.objects (
    user_id, collection_id, title, description,
    status, location_note, attributes
  )
  VALUES (
    auth.uid(),
    p_collection_id,
    v_data->>'title',
    v_data->>'description',
    COALESCE(NULLIF(v_data->>'status', ''), 'owned'),
    v_data->>'location_note',
    COALESCE(v_data->'attributes', '{}'::jsonb)
  )
  RETURNING id INTO v_obj_id;

  -- 2. Migrer ai_draft_images → object_images
  SELECT MIN(position) INTO v_min_pos
  FROM public.ai_draft_images
  WHERE draft_id = p_draft_id;

  IF v_min_pos IS NOT NULL THEN
    INSERT INTO public.object_images
      (object_id, user_id, storage_path, mime_type, size_bytes, position, is_cover)
    SELECT
      v_obj_id,
      auth.uid(),
      adi.storage_path,
      adi.mime_type,
      adi.size_bytes,
      adi.position,
      (adi.position = v_min_pos)
    FROM public.ai_draft_images adi
    WHERE adi.draft_id = p_draft_id
    ORDER BY adi.position;

    -- 3. Supprimer les lignes ai_draft_images
    --    Les fichiers Storage ne bougent pas ;
    --    ils sont désormais référencés uniquement par object_images.
    DELETE FROM public.ai_draft_images
    WHERE draft_id = p_draft_id;
  END IF;

  -- 4. Marquer le draft confirmé APRÈS la migration des images
  UPDATE public.ai_drafts
  SET
    status              = 'confirmed',
    confirmed_object_id = v_obj_id,
    confirmed_at        = now(),
    updated_at          = now()
  WHERE id = p_draft_id;

  -- 5. Journal
  INSERT INTO public.activity_log (user_id, object_id, action, payload)
  VALUES (
    auth.uid(),
    v_obj_id,
    'draft.confirmed',
    jsonb_build_object('draft_id', p_draft_id)
  );

  RETURN v_obj_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_draft FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.confirm_draft TO authenticated;

-- ── RPC : confirm_change_proposal ────────────────────────────────

CREATE OR REPLACE FUNCTION public.confirm_change_proposal(
  p_proposal_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_proposal  public.ai_change_proposals%ROWTYPE;
  v_coll_id   UUID;
  v_row_count INTEGER;
BEGIN
  SELECT * INTO v_proposal
  FROM public.ai_change_proposals
  WHERE id = p_proposal_id
    AND user_id = auth.uid()
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Proposition introuvable ou déjà traitée (id: %)', p_proposal_id;
  END IF;

  -- title : non vide
  IF v_proposal.proposed_changes ? 'title' THEN
    IF NULLIF(trim(v_proposal.proposed_changes->'title'->>'to'), '') IS NULL THEN
      RAISE EXCEPTION 'Le titre ne peut pas être vide';
    END IF;
  END IF;

  -- status : valeur connue
  IF v_proposal.proposed_changes ? 'status' THEN
    IF v_proposal.proposed_changes->'status'->>'to' NOT IN (
      'owned','stored','loaned','sold','given','lost'
    ) THEN
      RAISE EXCEPTION 'Statut inconnu : ''%''',
        v_proposal.proposed_changes->'status'->>'to';
    END IF;
  END IF;

  -- collection_id : UUID valide + appartenant à l'utilisateur
  IF v_proposal.proposed_changes ? 'collection_id' THEN
    BEGIN
      v_coll_id := (v_proposal.proposed_changes->'collection_id'->>'to')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'collection_id invalide : UUID attendu, reçu ''%''',
        v_proposal.proposed_changes->'collection_id'->>'to';
    END;
    IF NOT EXISTS (
      SELECT 1 FROM public.collections
      WHERE id = v_coll_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION
        'Collection introuvable ou accès refusé (id: %)', v_coll_id;
    END IF;
  END IF;

  -- attributes : objet JSON plat
  IF v_proposal.proposed_changes ? 'attributes' THEN
    IF NOT public.is_flat_json_object(
      v_proposal.proposed_changes->'attributes'->'to'
    ) THEN
      RAISE EXCEPTION
        'Les attributs doivent être un objet JSON plat (reçu : %)',
        jsonb_typeof(v_proposal.proposed_changes->'attributes'->'to');
    END IF;
  END IF;

  -- Application sur liste blanche (sans SQL dynamique)
  UPDATE public.objects
  SET
    title = CASE
      WHEN v_proposal.proposed_changes ? 'title'
      THEN v_proposal.proposed_changes->'title'->>'to'
      ELSE title END,
    description = CASE
      WHEN v_proposal.proposed_changes ? 'description'
      THEN v_proposal.proposed_changes->'description'->>'to'
      ELSE description END,
    status = CASE
      WHEN v_proposal.proposed_changes ? 'status'
      THEN v_proposal.proposed_changes->'status'->>'to'
      ELSE status END,
    location_note = CASE
      WHEN v_proposal.proposed_changes ? 'location_note'
      THEN v_proposal.proposed_changes->'location_note'->>'to'
      ELSE location_note END,
    collection_id = CASE
      WHEN v_proposal.proposed_changes ? 'collection_id'
      THEN v_coll_id
      ELSE collection_id END,
    attributes = CASE
      WHEN v_proposal.proposed_changes ? 'attributes'
      THEN attributes || (v_proposal.proposed_changes->'attributes'->'to')
      ELSE attributes END,
    updated_at = now()
  WHERE id = v_proposal.object_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count = 0 THEN
    RAISE EXCEPTION
      'Aucune ligne mise à jour : objet introuvable (id: %)',
      v_proposal.object_id;
  END IF;

  UPDATE public.ai_change_proposals
  SET status = 'confirmed', confirmed_at = now(), updated_at = now()
  WHERE id = p_proposal_id;

  INSERT INTO public.activity_log (user_id, object_id, action, payload)
  VALUES (
    auth.uid(),
    v_proposal.object_id,
    'change.confirmed',
    jsonb_build_object(
      'proposal_id', p_proposal_id,
      'changes', v_proposal.proposed_changes
    )
  );

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_change_proposal FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.confirm_change_proposal TO authenticated;

-- ── RPC : reject_draft ────────────────────────────────────────────
-- Accepte les statuts 'uploading' et 'pending' (annulation à tout
-- moment avant confirmation). Retourne les chemins Storage pour
-- suppression côté client.

CREATE OR REPLACE FUNCTION public.reject_draft(
  p_draft_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_paths TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_drafts
    WHERE id = p_draft_id
      AND user_id = auth.uid()
      AND status IN ('uploading', 'pending')
  ) THEN
    RAISE EXCEPTION
      'Draft introuvable ou déjà finalisé (id: %)', p_draft_id;
  END IF;

  SELECT array_agg(storage_path) INTO v_paths
  FROM public.ai_draft_images
  WHERE draft_id = p_draft_id;

  UPDATE public.ai_drafts
  SET status = 'rejected', updated_at = now()
  WHERE id = p_draft_id AND user_id = auth.uid();

  RETURN jsonb_build_object(
    'storage_paths_to_delete',
    to_jsonb(coalesce(v_paths, ARRAY[]::TEXT[]))
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_draft FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reject_draft TO authenticated;

-- ── RPC : delete_object ───────────────────────────────────────────
-- Seule porte de suppression d'un objet depuis un client authentifié.
-- Nettoie conversations.context_object_id avant suppression pour
-- respecter la FK composite (ON DELETE SET NULL interdirait de
-- nullifier uniquement context_object_id sans toucher user_id).
-- Retourne les chemins Storage pour suppression côté client.

CREATE OR REPLACE FUNCTION public.delete_object(
  p_object_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_paths TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.objects
    WHERE id = p_object_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION
      'Objet introuvable ou accès refusé (id: %)', p_object_id;
  END IF;

  -- Collecter les chemins Storage avant la suppression en cascade
  SELECT array_agg(storage_path) INTO v_paths
  FROM public.object_images
  WHERE object_id = p_object_id;

  -- Nettoyer conversations.context_object_id (FK composite sans ON DELETE SET NULL)
  UPDATE public.conversations
  SET context_object_id = NULL
  WHERE context_object_id = p_object_id AND user_id = auth.uid();

  -- Journal avant CASCADE
  INSERT INTO public.activity_log (user_id, object_id, action, payload)
  VALUES (
    auth.uid(),
    p_object_id,
    'object.deleted',
    jsonb_build_object(
      'storage_paths', to_jsonb(coalesce(v_paths, ARRAY[]::TEXT[])),
      'deleted_at',    now()
    )
  );

  -- Suppression (CASCADE → object_images, ai_change_proposals)
  DELETE FROM public.objects
  WHERE id = p_object_id AND user_id = auth.uid();

  RETURN jsonb_build_object(
    'deleted',                 true,
    'storage_paths_to_delete', to_jsonb(coalesce(v_paths, ARRAY[]::TEXT[]))
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_object FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_object TO authenticated;
