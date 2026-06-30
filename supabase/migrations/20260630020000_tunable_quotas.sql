-- ================================================================
-- 20260630020000_tunable_quotas.sql
-- profiles.plan · app_settings (quotas pilotables depuis le dashboard
-- admin) · enforcement objets/photos dans confirm_draft · get_ai_quota
-- et check_and_increment_ai_quota lisent désormais app_settings au
-- lieu d'une constante codée en dur.
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium'));

-- ── app_settings (singleton) ────────────────────────────────────

CREATE TABLE public.app_settings (
  id                     SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  free_ai_quota_monthly  INTEGER     NOT NULL DEFAULT 30,
  free_objects_max       INTEGER     NOT NULL DEFAULT 30,
  free_photos_per_object INTEGER     NOT NULL DEFAULT 1,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id) VALUES (1);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- Aucune policy : seul le service_role (dashboard admin) et les RPC
-- SECURITY DEFINER ci-dessous peuvent lire/écrire cette table.

CREATE TRIGGER set_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── get_ai_quota / check_and_increment_ai_quota : lisent app_settings ──

CREATE OR REPLACE FUNCTION public.get_ai_quota()
RETURNS TABLE(used INTEGER, quota INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_used     INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_plan     TEXT;
  v_limit    INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT ai_analyses_used, ai_quota_reset_at, plan
    INTO v_used, v_reset_at, v_plan
    FROM public.profiles
   WHERE id = auth.uid();

  IF now() >= v_reset_at THEN
    v_used := 0;
  END IF;

  IF v_plan = 'premium' THEN
    RETURN QUERY SELECT v_used, NULL::INTEGER, v_reset_at;
    RETURN;
  END IF;

  SELECT free_ai_quota_monthly INTO v_limit FROM public.app_settings WHERE id = 1;
  RETURN QUERY SELECT v_used, v_limit, v_reset_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_quota()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_used     INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_plan     TEXT;
  v_limit    INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT ai_analyses_used, ai_quota_reset_at, plan
    INTO v_used, v_reset_at, v_plan
    FROM public.profiles
   WHERE id = auth.uid();

  IF now() >= v_reset_at THEN
    UPDATE public.profiles
       SET ai_analyses_used  = 0,
           ai_quota_reset_at = date_trunc('month', now()) + interval '1 month'
     WHERE id = auth.uid();
    v_used := 0;
  END IF;

  IF v_plan = 'premium' THEN
    UPDATE public.profiles SET ai_analyses_used = ai_analyses_used + 1 WHERE id = auth.uid();
    RETURN TRUE;
  END IF;

  SELECT free_ai_quota_monthly INTO v_limit FROM public.app_settings WHERE id = 1;

  IF v_used >= v_limit THEN
    INSERT INTO public.activity_log (user_id, action, payload)
    VALUES (auth.uid(), 'quota.exceeded', jsonb_build_object('used', v_used, 'quota', v_limit));
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
     SET ai_analyses_used = ai_analyses_used + 1
   WHERE id = auth.uid();

  RETURN TRUE;
END;
$$;

-- ── confirm_draft : limite objets max + photos/objet pour le plan free ──

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
  SELECT plan INTO v_plan FROM public.profiles WHERE id = auth.uid();

  IF v_plan = 'free' THEN
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
$$;
