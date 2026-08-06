-- ================================================================
-- 20260701223930_premium_ai_quota_cap.sql
-- Retire le quota IA "illimité" en premium : plafond configurable
-- (5x le quota gratuit par défaut) pour éviter un risque de coût
-- API non maîtrisé sur les gros utilisateurs premium.
-- ================================================================

ALTER TABLE public.app_settings
  ADD COLUMN premium_ai_quota_monthly INTEGER NOT NULL DEFAULT 150;

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
    SELECT premium_ai_quota_monthly INTO v_limit FROM public.app_settings WHERE id = 1;
  ELSE
    SELECT free_ai_quota_monthly INTO v_limit FROM public.app_settings WHERE id = 1;
  END IF;

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
    SELECT premium_ai_quota_monthly INTO v_limit FROM public.app_settings WHERE id = 1;
  ELSE
    SELECT free_ai_quota_monthly INTO v_limit FROM public.app_settings WHERE id = 1;
  END IF;

  IF v_used >= v_limit THEN
    INSERT INTO public.activity_log (user_id, action, payload)
    VALUES (auth.uid(), 'quota.exceeded', jsonb_build_object('used', v_used, 'quota', v_limit, 'plan', v_plan));
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
     SET ai_analyses_used = ai_analyses_used + 1
   WHERE id = auth.uid();

  RETURN TRUE;
END;
$$;
