-- ================================================================
-- 20260807020000_scene_thumbnails.sql
-- Vignettes travaillees d'une scene : detourage sur fond blanc, ou
-- illustration generee quand la photo ne donne rien d'exploitable.
--
-- Trois choses ici, liees par la meme fonctionnalite :
--
-- 1. scene_analyses.thumbnails — l'image produite est payee (~4 c chez
--    Gemini). La perdre parce que l'utilisateur ferme l'ecran serait la
--    faire payer deux fois. Elle vit donc avec la scene, et une analyse
--    rejouee la retrouve.
--
-- 2. object_images.is_illustration — une image GENEREE n'est pas une
--    photo de l'objet du proprietaire. L'application porte des champs
--    d'assurance et des liens de partage : une image de synthese prise
--    pour une piece reelle serait une piece fausse. Le drapeau existe pour
--    que l'interface puisse toujours le dire. Un detourage, lui, reste la
--    vraie photo — il n'est pas marque.
--
-- 3. Correctif de plan sur le quota de retouche photo. Le quota testait
--    `plan <> 'premium'` : un compte 'pro', pourtant superieur et reconnu
--    payant partout ailleurs (is_paid_plan), se voyait refuser la retouche.
--    Le bug precede cette fonctionnalite et touche aussi « Ameliorer la
--    photo » ; il est corrige ici parce que les deux partagent ce quota.
-- ================================================================

ALTER TABLE public.scene_analyses
  ADD COLUMN IF NOT EXISTS thumbnails JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.scene_analyses.thumbnails IS
  'Rang de l objet dans result->objects -> {path, kind}. kind = cutout | generated.';

ALTER TABLE public.object_images
  ADD COLUMN IF NOT EXISTS is_illustration BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.object_images.is_illustration IS
  'true = image generee par IA, pas une photo de l objet. Doit rester visible comme telle a l affichage et au partage.';

-- ── Quota retouche : reconnaitre les plans payants ────────────────

CREATE OR REPLACE FUNCTION public.get_photo_enhance_quota()
RETURNS TABLE(used INTEGER, quota INTEGER, reset_at TIMESTAMPTZ, is_premium BOOLEAN)
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

  SELECT photo_enhance_used, photo_enhance_quota_reset_at,
         public.effective_plan(plan, pro_expires_at)
    INTO v_used, v_reset_at, v_plan
    FROM public.profiles
   WHERE id = auth.uid();

  IF now() >= v_reset_at THEN
    v_used := 0;
  END IF;

  IF NOT public.is_paid_plan(v_plan) THEN
    RETURN QUERY SELECT v_used, 0, v_reset_at, FALSE;
    RETURN;
  END IF;

  SELECT premium_photo_enhance_quota_monthly INTO v_limit FROM public.app_settings WHERE id = 1;
  RETURN QUERY SELECT v_used, v_limit, v_reset_at, TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_photo_enhance_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_photo_enhance_quota() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_and_increment_photo_enhance_quota()
RETURNS TEXT
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

  SELECT photo_enhance_used, photo_enhance_quota_reset_at,
         public.effective_plan(plan, pro_expires_at)
    INTO v_used, v_reset_at, v_plan
    FROM public.profiles
   WHERE id = auth.uid();

  IF NOT public.is_paid_plan(v_plan) THEN
    RETURN 'NOT_PREMIUM';
  END IF;

  IF now() >= v_reset_at THEN
    UPDATE public.profiles
       SET photo_enhance_used  = 0,
           photo_enhance_quota_reset_at = date_trunc('month', now()) + interval '1 month'
     WHERE id = auth.uid();
    v_used := 0;
  END IF;

  SELECT premium_photo_enhance_quota_monthly INTO v_limit FROM public.app_settings WHERE id = 1;

  IF v_used >= v_limit THEN
    INSERT INTO public.activity_log (user_id, action, payload)
    VALUES (auth.uid(), 'photo_enhance.quota_exceeded', jsonb_build_object('used', v_used, 'quota', v_limit));
    RETURN 'QUOTA_EXCEEDED';
  END IF;

  UPDATE public.profiles
     SET photo_enhance_used = photo_enhance_used + 1
   WHERE id = auth.uid();

  RETURN 'OK';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_photo_enhance_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_photo_enhance_quota() TO authenticated;

-- ── create_objects_from_scene v4 : porter le drapeau illustration ─
-- Le client sait quelle ligne a recu une image generee ; la fiche doit
-- naitre en le sachant, pas l'apprendre par un UPDATE d'apres coup.

CREATE OR REPLACE FUNCTION public.create_objects_from_scene(
  p_objects       JSONB,
  p_scene_id      UUID DEFAULT NULL,
  p_collection_id UUID DEFAULT NULL
)
RETURNS TABLE (object_id UUID, image_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_plan        TEXT;
  v_objects_max INTEGER;
  v_objects_now INTEGER;
  v_count       INTEGER;
  v_created     INTEGER := 0;
  v_item        JSONB;
  v_obj_id      UUID;
  v_scene_path  TEXT;
  v_scene_mime  TEXT;
  v_ext         TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF jsonb_typeof(p_objects) <> 'array' THEN
    RAISE EXCEPTION 'p_objects doit etre un tableau JSON';
  END IF;

  v_count := jsonb_array_length(p_objects);
  IF v_count = 0 THEN RETURN; END IF;
  IF v_count > 50 THEN
    RAISE EXCEPTION 'SCENE_TOO_LARGE: 50 objets maximum par scene';
  END IF;

  IF p_scene_id IS NOT NULL THEN
    SELECT s.storage_path, s.mime_type INTO v_scene_path, v_scene_mime
      FROM public.scene_analyses s
     WHERE s.id = p_scene_id AND s.user_id = v_uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SCENE_NOT_FOUND: analyse introuvable ou acces refuse (id: %)', p_scene_id;
    END IF;
  END IF;

  v_ext := CASE v_scene_mime
             WHEN 'image/png'  THEN '.png'
             WHEN 'image/webp' THEN '.webp'
             WHEN 'image/heic' THEN '.heic'
             ELSE '.jpg'
           END;

  IF p_collection_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.collections
      WHERE id = p_collection_id AND user_id = v_uid
    ) THEN
      RAISE EXCEPTION 'Collection introuvable ou acces refuse (id: %)', p_collection_id;
    END IF;
  END IF;

  SELECT public.effective_plan(plan, pro_expires_at) INTO v_plan
    FROM public.profiles WHERE id = v_uid;

  IF NOT public.is_paid_plan(v_plan) THEN
    SELECT free_objects_max INTO v_objects_max FROM public.app_settings WHERE id = 1;
    SELECT count(*) INTO v_objects_now FROM public.objects WHERE user_id = v_uid;

    IF v_objects_now + v_count > v_objects_max THEN
      RAISE EXCEPTION
        'OBJECT_QUOTA_EXCEEDED: % objets demandes, % restants sur % au total',
        v_count, GREATEST(0, v_objects_max - v_objects_now), v_objects_max;
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_objects)
  LOOP
    INSERT INTO public.objects (user_id, collection_id, title, status, quantity, attributes)
    VALUES (
      v_uid,
      p_collection_id,
      COALESCE(NULLIF(btrim(v_item->>'title'), ''), 'Nouvel objet'),
      'owned',
      GREATEST(1, LEAST(999, COALESCE((v_item->>'quantity')::INTEGER, 1))),
      CASE
        WHEN COALESCE(NULLIF(btrim(v_item->>'category'), ''), '') = '' THEN '{}'::jsonb
        ELSE jsonb_build_object('category', btrim(v_item->>'category'))
      END
    )
    RETURNING id INTO v_obj_id;

    object_id  := v_obj_id;
    image_path := NULL;

    IF v_scene_path IS NOT NULL THEN
      image_path := v_uid::TEXT || '/' || v_obj_id::TEXT || '/'
                    || gen_random_uuid()::TEXT || v_ext;

      INSERT INTO public.object_images
        (object_id, user_id, storage_path, mime_type, position, is_cover, is_illustration)
      VALUES (
        v_obj_id, v_uid, image_path, COALESCE(v_scene_mime, 'image/jpeg'), 0, TRUE,
        COALESCE((v_item->>'illustration')::BOOLEAN, FALSE)
      );
    END IF;

    INSERT INTO public.activity_log (user_id, object_id, action, payload)
    VALUES (v_uid, v_obj_id, 'scene.confirmed',
            jsonb_build_object('from', 'detect_scene', 'scene_id', p_scene_id));

    v_created := v_created + 1;
    RETURN NEXT;
  END LOOP;

  IF p_scene_id IS NOT NULL THEN
    UPDATE public.scene_analyses
       SET objects_created = objects_created + v_created,
           confirmed_at    = COALESCE(confirmed_at, now()),
           collection_id   = COALESCE(p_collection_id, collection_id)
     WHERE id = p_scene_id AND user_id = v_uid;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_objects_from_scene(JSONB, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_objects_from_scene(JSONB, UUID, UUID) TO authenticated;
