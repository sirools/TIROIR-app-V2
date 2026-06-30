-- ================================================================
-- 20260628060617_ai_quota_50_per_month.sql
-- Quota mensuel d'analyses IA (30/mois) : profiles.ai_analyses_used,
-- profiles.ai_quota_reset_at, get_ai_quota(), check_and_increment_ai_quota()
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_analyses_used  INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month');

CREATE OR REPLACE FUNCTION public.get_ai_quota()
RETURNS TABLE(used INTEGER, quota INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_used     INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT ai_analyses_used, ai_quota_reset_at
    INTO v_used, v_reset_at
    FROM public.profiles
   WHERE id = auth.uid();

  IF now() >= v_reset_at THEN
    v_used := 0;
  END IF;

  RETURN QUERY SELECT v_used, 30::INTEGER, v_reset_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_ai_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_quota() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_quota()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_used     INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_limit    CONSTANT INTEGER := 30;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT ai_analyses_used, ai_quota_reset_at
    INTO v_used, v_reset_at
    FROM public.profiles
   WHERE id = auth.uid();

  IF now() >= v_reset_at THEN
    UPDATE public.profiles
       SET ai_analyses_used  = 0,
           ai_quota_reset_at = date_trunc('month', now()) + interval '1 month'
     WHERE id = auth.uid();
    v_used := 0;
  END IF;

  IF v_used >= v_limit THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
     SET ai_analyses_used = ai_analyses_used + 1
   WHERE id = auth.uid();

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_ai_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_quota() TO authenticated;
