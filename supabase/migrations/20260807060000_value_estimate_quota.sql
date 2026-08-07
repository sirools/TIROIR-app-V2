-- ================================================================
-- 20260807060000_value_estimate_quota.sql
-- Quota sur l'estimation de valeur marchande.
--
-- C'etait la derniere fonction IA sans plafond, et probablement la plus
-- chere de l'application : Sonnet avec recherche web, jusqu'a cinq
-- allers-retours par estimation, chaque recherche facturee en plus des
-- tokens. Un compte gratuit pouvait en enchainer autant qu'il voulait.
--
-- Compteur separe plutot que poids sur le quota d'analyses : c'est une
-- promesse differente, qui s'affiche telle quelle sur la page de tarifs
-- (« N estimations / mois ») et se regle independamment. Meme forme que
-- le quota de retouche photo, dont il reprend la mecanique.
--
-- Les valeurs par defaut sont PROVISOIRES : le cout reel de cette
-- fonction n'a jamais ete mesure — ai_usage ne la couvre que depuis
-- aujourd'hui. Elles sont volontairement basses et pilotables depuis le
-- tableau de bord ; a revoir des que la premiere mesure existe.
-- ================================================================

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS free_value_estimate_monthly    INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS premium_value_estimate_monthly INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS pro_value_estimate_monthly     INTEGER NOT NULL DEFAULT 60;

COMMENT ON COLUMN public.app_settings.free_value_estimate_monthly IS
  'Estimations de valeur par mois, plan gratuit. Valeur provisoire tant que le cout reel n est pas mesure.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS value_estimate_used            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS value_estimate_quota_reset_at  TIMESTAMPTZ NOT NULL
    DEFAULT date_trunc('month', now()) + interval '1 month';

-- ── Lecture ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_value_estimate_quota()
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

  SELECT value_estimate_used, value_estimate_quota_reset_at,
         public.effective_plan(plan, pro_expires_at)
    INTO v_used, v_reset_at, v_plan
    FROM public.profiles
   WHERE id = auth.uid();

  IF now() >= v_reset_at THEN
    v_used := 0;
  END IF;

  SELECT CASE v_plan
           WHEN 'pro'     THEN pro_value_estimate_monthly
           WHEN 'premium' THEN premium_value_estimate_monthly
           ELSE                free_value_estimate_monthly
         END
    INTO v_limit
    FROM public.app_settings WHERE id = 1;

  RETURN QUERY SELECT v_used, v_limit, v_reset_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_value_estimate_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_value_estimate_quota() TO authenticated;

-- ── Consommation ──────────────────────────────────────────────────
-- Retourne 'OK' | 'QUOTA_EXCEEDED'. Pas de 'NOT_PREMIUM' : contrairement
-- a la retouche photo, l'estimation reste ouverte au plan gratuit — elle
-- y est seulement rare.

CREATE OR REPLACE FUNCTION public.check_and_increment_value_estimate_quota()
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

  SELECT value_estimate_used, value_estimate_quota_reset_at,
         public.effective_plan(plan, pro_expires_at)
    INTO v_used, v_reset_at, v_plan
    FROM public.profiles
   WHERE id = auth.uid();

  IF now() >= v_reset_at THEN
    UPDATE public.profiles
       SET value_estimate_used = 0,
           value_estimate_quota_reset_at = date_trunc('month', now()) + interval '1 month'
     WHERE id = auth.uid();
    v_used := 0;
  END IF;

  SELECT CASE v_plan
           WHEN 'pro'     THEN pro_value_estimate_monthly
           WHEN 'premium' THEN premium_value_estimate_monthly
           ELSE                free_value_estimate_monthly
         END
    INTO v_limit
    FROM public.app_settings WHERE id = 1;

  IF v_used >= v_limit THEN
    INSERT INTO public.activity_log (user_id, action, payload)
    VALUES (auth.uid(), 'value_estimate.quota_exceeded',
            jsonb_build_object('used', v_used, 'quota', v_limit, 'plan', v_plan));
    RETURN 'QUOTA_EXCEEDED';
  END IF;

  UPDATE public.profiles
     SET value_estimate_used = value_estimate_used + 1
   WHERE id = auth.uid();

  RETURN 'OK';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_value_estimate_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_value_estimate_quota() TO authenticated;

-- ── Restitution ───────────────────────────────────────────────────
-- Le jeton est preleve avant l'appel, sinon rien n'empeche d'enchainer
-- les tentatives. Une panne du fournisseur ne doit pas etre facturee.

CREATE OR REPLACE FUNCTION public.refund_value_estimate_quota()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  UPDATE public.profiles
     SET value_estimate_used = GREATEST(0, value_estimate_used - 1)
   WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_value_estimate_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_value_estimate_quota() TO authenticated;
