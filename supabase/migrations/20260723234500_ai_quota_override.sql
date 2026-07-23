-- ================================================================
-- 20260723234500_ai_quota_override.sql
-- Override de quota IA par compte (comptes de test, futurs comptes
-- pro) sans toucher aux réglages globaux d'app_settings.
--
-- Deux colonnes nullables sur profiles :
--   · ai_quota_override → plafond propre au compte, prioritaire sur
--     le plafond du plan.
--   · ai_quota_period   → périodicité de remise à zéro ('month' par
--     défaut, 'week' possible).
--
-- Comportement inchangé pour tout compte dont les deux colonnes sont
-- à NULL : les 17 comptes gratuits existants ne bougent pas.
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN ai_quota_override INTEGER
    CHECK (ai_quota_override IS NULL OR ai_quota_override > 0),
  ADD COLUMN ai_quota_period   TEXT NOT NULL DEFAULT 'month'
    CHECK (ai_quota_period IN ('month', 'week'));

-- ── Helpers ──────────────────────────────────────────────────────

-- Prochaine date de remise à zéro selon la périodicité du compte.
CREATE OR REPLACE FUNCTION public.next_ai_quota_reset(p_period TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT CASE
    WHEN p_period = 'week' THEN date_trunc('week', now()) + interval '1 week'
    ELSE date_trunc('month', now()) + interval '1 month'
  END;
$$;

-- Plafond effectif : override du compte s'il existe, sinon plafond
-- du plan lu dans app_settings.
CREATE OR REPLACE FUNCTION public.effective_ai_quota(
  p_override INTEGER,
  p_plan     TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT COALESCE(
    p_override,
    CASE WHEN p_plan = 'premium'
      THEN (SELECT premium_ai_quota_monthly FROM public.app_settings WHERE id = 1)
      ELSE (SELECT free_ai_quota_monthly    FROM public.app_settings WHERE id = 1)
    END
  );
$$;

-- ── get_ai_quota ─────────────────────────────────────────────────

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
  v_override INTEGER;
  v_period   TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT ai_analyses_used, ai_quota_reset_at, plan, ai_quota_override, ai_quota_period
    INTO v_used, v_reset_at, v_plan, v_override, v_period
    FROM public.profiles
   WHERE id = auth.uid();

  IF now() >= v_reset_at THEN
    v_used     := 0;
    v_reset_at := public.next_ai_quota_reset(v_period);
  END IF;

  RETURN QUERY
    SELECT v_used, public.effective_ai_quota(v_override, v_plan), v_reset_at;
END;
$$;

-- ── check_and_increment_ai_quota ─────────────────────────────────

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
  v_override INTEGER;
  v_period   TEXT;
  v_limit    INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT ai_analyses_used, ai_quota_reset_at, plan, ai_quota_override, ai_quota_period
    INTO v_used, v_reset_at, v_plan, v_override, v_period
    FROM public.profiles
   WHERE id = auth.uid();

  IF now() >= v_reset_at THEN
    UPDATE public.profiles
       SET ai_analyses_used  = 0,
           ai_quota_reset_at = public.next_ai_quota_reset(v_period)
     WHERE id = auth.uid();
    v_used := 0;
  END IF;

  v_limit := public.effective_ai_quota(v_override, v_plan);

  IF v_used >= v_limit THEN
    INSERT INTO public.activity_log (user_id, action, payload)
    VALUES (
      auth.uid(),
      'quota.exceeded',
      jsonb_build_object('used', v_used, 'quota', v_limit, 'plan', v_plan)
    );
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
     SET ai_analyses_used = ai_analyses_used + 1
   WHERE id = auth.uid();

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.next_ai_quota_reset(TEXT)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.effective_ai_quota(INTEGER, TEXT)  FROM PUBLIC, anon;
