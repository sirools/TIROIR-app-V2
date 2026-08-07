-- ================================================================
-- 20260807012600_create_objects_from_scene_v3.sql
-- create_objects_from_scene() : une photo par fiche, adossee a une scene.
--
-- La v1 faisait porter LE MEME storage_path aux N fiches du lot. Trois
-- raisons pour lesquelles cela ne pouvait pas tenir :
--
--   1. object_images porte UNIQUE (storage_path) : la deuxieme fiche du lot
--      violait la contrainte et faisait rouler toute la transaction.
--   2. delete_object rend les chemins a effacer et le client les supprime :
--      supprimer UNE fiche du lot aurait efface la photo des douze autres.
--   3. le fichier lui-meme ne pouvait pas etre ecrit — voir 20260807012500.
--
-- Donc : chaque fiche possede son fichier. La fonction ne copie rien (le
-- stockage ne se copie pas en SQL) : elle CALCULE le chemin de chaque fiche
-- et le rend au client, qui declenche une copie server-side depuis la photo
-- de scene. Un seul envoi depuis le telephone, N copies cote Supabase.
--
-- Les lignes object_images sont ecrites dans la transaction, avant que les
-- fichiers existent. Si une copie echoue, le client efface la ligne
-- correspondante : une fiche sans photo, jamais une vignette cassee.
--
-- Signature changee (p_storage_path/p_mime_type -> p_scene_id) : l'ancienne
-- est supprimee plutot que laissee en place, elle ne pouvait produire qu'une
-- erreur. Fonctionnalite encore derriere le drapeau admin, aucun appelant
-- en production.
-- ================================================================

DROP FUNCTION IF EXISTS public.create_objects_from_scene(JSONB, UUID, TEXT, TEXT);

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

  -- La scene est facultative : sans elle, les fiches se creent sans photo
  -- plutot que d'echouer. Mais si elle est fournie, elle doit etre a nous.
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

  -- Plafond verifie sur l'ENSEMBLE du lot : creer 5 fiches sur 13 puis
  -- echouer est pire que refuser d'emblee.
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
      -- Chemin conforme a la policy INSERT du bucket : {uid}/{object_id}/...
      image_path := v_uid::TEXT || '/' || v_obj_id::TEXT || '/'
                    || gen_random_uuid()::TEXT || v_ext;

      INSERT INTO public.object_images
        (object_id, user_id, storage_path, mime_type, position, is_cover)
      VALUES (v_obj_id, v_uid, image_path, COALESCE(v_scene_mime, 'image/jpeg'), 0, TRUE);
    END IF;

    INSERT INTO public.activity_log (user_id, object_id, action, payload)
    VALUES (v_uid, v_obj_id, 'scene.confirmed',
            jsonb_build_object('from', 'detect_scene', 'scene_id', p_scene_id));

    v_created := v_created + 1;
    RETURN NEXT;
  END LOOP;

  -- Cumulatif : une scene peut alimenter deux creations successives.
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

COMMENT ON FUNCTION public.create_objects_from_scene(JSONB, UUID, UUID) IS
  'Cree N fiches depuis une analyse de scene et rend, pour chacune, le chemin Storage ou copier la photo de scene. La copie est declenchee par le client : elle n existe pas en SQL.';
