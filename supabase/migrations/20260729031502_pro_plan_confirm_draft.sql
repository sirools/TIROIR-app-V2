-- ================================================================
-- 20260729031502_pro_plan_confirm_draft.sql
-- Suite de 20260729210000_pro_plan.sql.
-- ================================================================

-- ── 8. confirm_draft : plafonds gratuits basés sur le plan effectif ─
-- Seule évolution : le plan lu passe par effective_plan(), pour qu'un Pro
-- échu retrouve les plafonds du gratuit à la confirmation d'un objet.
CREATE OR REPLACE FUNCTION public.confirm_draft(p_draft_id uuid, p_collection_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_draft       public.ai_drafts%ROWTYPE;
  v_data        JSONB;
  v_obj_id      UUID;
  v_min_pos     INTEGER;
  v_plan        TEXT;
  v_objects_max INTEGER;
  v_photos_max  INTEGER;
  v_objects_now INTEGER;
  v_images_now  INTEGER;
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

  -- Quotas plan gratuit (objets max, photos/objet)
  SELECT public.effective_plan(plan, pro_expires_at) INTO v_plan
    FROM public.profiles WHERE id = auth.uid();

  IF NOT public.is_paid_plan(v_plan) THEN
    SELECT free_objects_max, free_photos_per_object
      INTO v_objects_max, v_photos_max
      FROM public.app_settings WHERE id = 1;

    SELECT count(*) INTO v_objects_now
      FROM public.objects WHERE user_id = auth.uid();

    IF v_objects_now >= v_objects_max THEN
      RAISE EXCEPTION 'OBJECT_QUOTA_EXCEEDED: limite de % objets atteinte', v_objects_max;
    END IF;

    SELECT count(*) INTO v_images_now
      FROM public.ai_draft_images WHERE draft_id = p_draft_id;

    IF v_images_now > v_photos_max THEN
      RAISE EXCEPTION 'PHOTO_QUOTA_EXCEEDED: % photos max par objet en gratuit', v_photos_max;
    END IF;
  END IF;

  v_data := v_draft.proposed_data;

  IF NOT public.is_flat_json_object(COALESCE(v_data->'attributes', '{}'::jsonb)) THEN
    RAISE EXCEPTION
      'Les attributs proposés doivent être un objet JSON plat '
      '(pas d''objets ni de tableaux imbriqués)';
  END IF;

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

    DELETE FROM public.ai_draft_images
    WHERE draft_id = p_draft_id;
  END IF;

  UPDATE public.ai_drafts
  SET
    status              = 'confirmed',
    confirmed_object_id = v_obj_id,
    confirmed_at        = now(),
    updated_at          = now()
  WHERE id = p_draft_id;

  INSERT INTO public.activity_log (user_id, object_id, action, payload)
  VALUES (
    auth.uid(),
    v_obj_id,
    'draft.confirmed',
    jsonb_build_object('draft_id', p_draft_id)
  );

  RETURN v_obj_id;
END;
$function$;
