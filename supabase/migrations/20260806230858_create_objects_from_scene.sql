-- ================================================================
-- 20260806230858_create_objects_from_scene.sql
-- create_objects_from_scene() : cree N fiches depuis une detection de scene.
--
-- Une seule transaction plutot que deux allers-retours par objet
-- (create_empty_object puis update) : sur une scene de onze objets cela
-- ferait vingt-deux appels reseau, et un echec au milieu laisserait un
-- inventaire a moitie cree.
--
-- Le plafond gratuit est verifie sur l'ENSEMBLE du lot, pas objet par objet :
-- creer 5 fiches sur 11 puis echouer est pire que refuser d'emblee.
--
-- La photo de scene est partagee : un seul fichier en Storage, reference par
-- chaque fiche creee. Le decoupage par objet viendra quand le banc aura dit
-- si les boites renvoyees par le modele sont exploitables.
--
-- NOTE : cette version ecrit l'id de l'objet dans activity_log.user_id.
-- Corrige immediatement par 20260806230918. Conservee telle qu'appliquee
-- pour que rejouer ce dossier reproduise l'historique reel de la base.
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_objects_from_scene(
  p_objects       JSONB,
  p_collection_id UUID DEFAULT NULL,
  p_storage_path  TEXT DEFAULT NULL,
  p_mime_type     TEXT DEFAULT 'image/jpeg'
)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_plan        TEXT;
  v_objects_max INTEGER;
  v_objects_now INTEGER;
  v_count       INTEGER;
  v_item        JSONB;
  v_obj_id      UUID;
BEGIN
  IF auth.uid() IS NULL THEN
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

  IF p_collection_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.collections
      WHERE id = p_collection_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Collection introuvable ou acces refuse (id: %)', p_collection_id;
    END IF;
  END IF;

  SELECT public.effective_plan(plan, pro_expires_at) INTO v_plan
    FROM public.profiles WHERE id = auth.uid();

  IF NOT public.is_paid_plan(v_plan) THEN
    SELECT free_objects_max INTO v_objects_max FROM public.app_settings WHERE id = 1;
    SELECT count(*) INTO v_objects_now FROM public.objects WHERE user_id = auth.uid();

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
      auth.uid(),
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

    IF p_storage_path IS NOT NULL THEN
      INSERT INTO public.object_images
        (object_id, user_id, storage_path, mime_type, position, is_cover)
      VALUES (v_obj_id, auth.uid(), p_storage_path, p_mime_type, 0, TRUE);
    END IF;

    INSERT INTO public.activity_log (user_id, object_id, action, payload)
    VALUES (v_obj_id, v_obj_id, 'scene.confirmed', jsonb_build_object('from', 'detect_scene'))
    ON CONFLICT DO NOTHING;

    RETURN NEXT v_obj_id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_objects_from_scene(JSONB, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_objects_from_scene(JSONB, UUID, TEXT, TEXT) TO authenticated;
