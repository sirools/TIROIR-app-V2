-- ================================================================
-- 20260701224534_photo_enhance_quota.sql
-- Feature "Améliorer la photo" (retouche IA via Gemini) : réservée
-- aux comptes premium, plafonnée à 50/mois par défaut (configurable
-- via app_settings, jamais illimité).
-- ================================================================

ALTER TABLE public.app_settings
  ADD COLUMN premium_photo_enhance_quota_monthly INTEGER NOT NULL DEFAULT 50;

ALTER TABLE public.profiles
  ADD COLUMN photo_enhance_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN photo_enhance_quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month';

-- ── get_photo_enhance_quota ──────────────────────────────────────

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

  SELECT photo_enhance_used, photo_enhance_quota_reset_at, plan
    INTO v_used, v_reset_at, v_plan
    FROM public.profiles
   WHERE id = auth.uid();

  IF now() >= v_reset_at THEN
    v_used := 0;
  END IF;

  IF v_plan <> 'premium' THEN
    RETURN QUERY SELECT v_used, 0, v_reset_at, FALSE;
    RETURN;
  END IF;

  SELECT premium_photo_enhance_quota_monthly INTO v_limit FROM public.app_settings WHERE id = 1;
  RETURN QUERY SELECT v_used, v_limit, v_reset_at, TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_photo_enhance_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_photo_enhance_quota() TO authenticated;

-- ── check_and_increment_photo_enhance_quota ──────────────────────
-- Retourne 'OK' | 'NOT_PREMIUM' | 'QUOTA_EXCEEDED'

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

  SELECT photo_enhance_used, photo_enhance_quota_reset_at, plan
    INTO v_used, v_reset_at, v_plan
    FROM public.profiles
   WHERE id = auth.uid();

  IF v_plan <> 'premium' THEN
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
