-- ================================================================
-- 20260807110000_object_cap_holes_and_collection_fuse.sql
-- Le plafond d'objets du plan gratuit n'en etait pas tout a fait un,
-- et rien ne bornait le nombre de collections.
--
-- ── Ce qui etait deja correct ─────────────────────────────────────
-- confirm_draft verifie le plafond. confirm_batch aussi, par delegation :
-- il appelle confirm_draft dans une boucle et rapporte les echecs ligne
-- par ligne. create_objects_from_scene verifie le lot entier.
--
-- ── Le trou ───────────────────────────────────────────────────────
-- create_empty_object ne verifiait rien. C'est le chemin « Ajouter sans
-- IA » : le plus direct, et le seul par lequel un compte gratuit pouvait
-- depasser sa limite sans jamais la rencontrer.
--
-- ── Le gaspillage ─────────────────────────────────────────────────
-- begin_batch_capture reservait un lot de N sans regarder s'il restait de
-- la place. Un compte gratuit a 98 objets sur 100 pouvait lancer vingt
-- analyses : les vingt s'executaient, consommaient vingt credits IA et
-- des tokens reels, puis dix-huit echouaient a la confirmation. Refuser
-- avant l'analyse coute un message ; refuser apres coute de l'argent.
--
-- ── Le fusible sur les collections ────────────────────────────────
-- Aucune limite n'existait. Ce n'est PAS une limite commerciale : une
-- collection coute une ligne, et plafonner l'organisation punirait
-- l'utilisateur le plus investi. C'est un garde-fou contre l'emballement,
-- pose haut, que personne ne doit rencontrer. Il vit dans un declencheur
-- et non dans une RPC : les collections se creent par insertion directe
-- depuis le client, il n'y a pas de fonction unique a garder.
-- ================================================================

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS max_collections_per_account INTEGER NOT NULL DEFAULT 200;

COMMENT ON COLUMN public.app_settings.max_collections_per_account IS
  'Garde-fou anti-emballement, pas une offre. Personne ne doit le rencontrer.';

-- ── create_empty_object : le plafond s'applique aussi ici ─────────

CREATE OR REPLACE FUNCTION public.create_empty_object()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_object_id   UUID;
  v_plan        TEXT;
  v_objects_max INTEGER;
  v_objects_now INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT public.effective_plan(plan, pro_expires_at) INTO v_plan
    FROM public.profiles WHERE id = auth.uid();

  IF NOT public.is_paid_plan(v_plan) THEN
    SELECT free_objects_max INTO v_objects_max FROM public.app_settings WHERE id = 1;
    SELECT count(*) INTO v_objects_now FROM public.objects WHERE user_id = auth.uid();

    -- Meme code et meme forme de message que confirm_draft : le client
    -- reconnait un seul motif, quel que soit le chemin de creation.
    IF v_objects_now >= v_objects_max THEN
      RAISE EXCEPTION 'OBJECT_QUOTA_EXCEEDED: limite de % objets atteinte', v_objects_max;
    END IF;
  END IF;

  INSERT INTO public.objects (user_id, title, status, attributes)
  VALUES (auth.uid(), 'Nouvel objet', 'owned', '{}'::jsonb)
  RETURNING id INTO v_object_id;

  RETURN v_object_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_empty_object() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_empty_object() TO authenticated;

-- ── begin_batch_capture : refuser avant de depenser ───────────────

CREATE OR REPLACE FUNCTION public.begin_batch_capture(p_size INTEGER)
RETURNS TABLE(batch_id UUID, draft_id UUID, batch_position INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_batch_id    UUID := gen_random_uuid();
  v_plan        TEXT;
  v_objects_max INTEGER;
  v_objects_now INTEGER;
  v_room        INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF p_size IS NULL OR p_size < 1 OR p_size > 100 THEN
    RAISE EXCEPTION 'BATCH_SIZE_INVALID: taille de lot invalide (reçu: %)', p_size;
  END IF;

  SELECT public.effective_plan(plan, pro_expires_at) INTO v_plan
    FROM public.profiles WHERE id = auth.uid();

  IF NOT public.is_paid_plan(v_plan) THEN
    SELECT free_objects_max INTO v_objects_max FROM public.app_settings WHERE id = 1;
    SELECT count(*) INTO v_objects_now FROM public.objects WHERE user_id = auth.uid();
    v_room := GREATEST(0, v_objects_max - v_objects_now);

    -- Le lot entier est verifie avant la moindre analyse : laisser partir
    -- vingt analyses pour n'en confirmer que deux facturerait vingt
    -- credits et des tokens reels pour dix-huit fiches jamais creees.
    IF p_size > v_room THEN
      RAISE EXCEPTION
        'OBJECT_QUOTA_EXCEEDED: % photos demandees, % place(s) restante(s) sur % au total',
        p_size, v_room, v_objects_max;
    END IF;
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

REVOKE EXECUTE ON FUNCTION public.begin_batch_capture(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_batch_capture(INTEGER) TO authenticated;

-- ── Fusible sur les collections ───────────────────────────────────
-- Compte sur NEW.user_id et non sur auth.uid() : le declencheur doit
-- tenir aussi pour une insertion faite en service_role, ou auth.uid()
-- est nul.

CREATE OR REPLACE FUNCTION public.enforce_collection_ceiling()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_max INTEGER;
  v_now INTEGER;
BEGIN
  SELECT max_collections_per_account INTO v_max FROM public.app_settings WHERE id = 1;
  IF v_max IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_now FROM public.collections WHERE user_id = NEW.user_id;

  IF v_now >= v_max THEN
    RAISE EXCEPTION 'COLLECTION_CEILING_REACHED: % collections maximum par compte', v_max;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collections_ceiling ON public.collections;

CREATE TRIGGER collections_ceiling
  BEFORE INSERT ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_collection_ceiling();
