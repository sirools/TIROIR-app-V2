-- ================================================================
-- 20260729210000_pro_plan.sql
-- Troisième palier d'abonnement : « Professionnel ».
--
-- Vendu en direct sur facture (hors stores, donc hors RevenueCat) :
-- l'attribution est manuelle, depuis le dashboard admin. Le palier
-- ouvre les mêmes fonctionnalités que le Premium, avec des quotas IA
-- plus élevés, et porte les informations de facturation.
--
-- Un compte Pro dont la période facturée est échue
-- (pro_expires_at < aujourd'hui) retombe automatiquement en gratuit,
-- sans tâche planifiée : la bascule est calculée à la lecture par
-- public.effective_plan().
-- ================================================================

-- ── 1. Nouveau palier accepté par profiles.plan ──────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan = ANY (ARRAY['free'::text, 'premium'::text, 'pro'::text]));

-- ── 2. Suivi commercial du compte Pro ────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_since       DATE,
  -- NULL = pas de date de fin (abonnement ouvert, résiliation manuelle)
  ADD COLUMN IF NOT EXISTS pro_expires_at  DATE,
  ADD COLUMN IF NOT EXISTS pro_invoice_ref TEXT,
  ADD COLUMN IF NOT EXISTS pro_company     TEXT;

COMMENT ON COLUMN public.profiles.pro_expires_at IS
  'Fin de la période facturée. Dépassée, le compte est traité comme gratuit (voir effective_plan).';

-- ── 3. Quotas Pro pilotables depuis le dashboard admin ───────────
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS pro_ai_quota_monthly            INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS pro_photo_enhance_quota_monthly INTEGER NOT NULL DEFAULT 100;

-- ── 4. Plan effectif : applique l'expiration d'un Pro facturé ────
CREATE OR REPLACE FUNCTION public.effective_plan(p_plan TEXT, p_pro_expires_at DATE)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
  SELECT CASE
    WHEN p_plan = 'pro'
     AND p_pro_expires_at IS NOT NULL
     AND p_pro_expires_at < CURRENT_DATE
    THEN 'free'
    ELSE p_plan
  END;
$$;

-- Vrai pour tout palier payant : évite d'éparpiller les comparaisons.
CREATE OR REPLACE FUNCTION public.is_paid_plan(p_plan TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
  SELECT p_plan IN ('premium', 'pro');
$$;

-- ── 5. Quota IA : le Pro a son propre plafond ────────────────────
CREATE OR REPLACE FUNCTION public.effective_ai_quota(p_override INTEGER, p_plan TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
  SELECT COALESCE(
    p_override,
    CASE p_plan
      WHEN 'pro'     THEN (SELECT pro_ai_quota_monthly     FROM public.app_settings WHERE id = 1)
      WHEN 'premium' THEN (SELECT premium_ai_quota_monthly FROM public.app_settings WHERE id = 1)
      ELSE                (SELECT free_ai_quota_monthly    FROM public.app_settings WHERE id = 1)
    END
  );
$$;

CREATE OR REPLACE FUNCTION public.get_ai_quota()
RETURNS TABLE(used INTEGER, quota INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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

  SELECT ai_analyses_used, ai_quota_reset_at,
         public.effective_plan(plan, pro_expires_at), ai_quota_override, ai_quota_period
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
$function$;

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_quota()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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

  SELECT ai_analyses_used, ai_quota_reset_at,
         public.effective_plan(plan, pro_expires_at), ai_quota_override, ai_quota_period
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
$function$;

-- ── 6. Objets / photos : le Pro est illimité comme le Premium ────
CREATE OR REPLACE FUNCTION public.get_plan_limits()
RETURNS TABLE(objects_used INTEGER, objects_max INTEGER, photos_per_object INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_plan        TEXT;
  v_objects_max INTEGER;
  v_photos      INTEGER;
  v_count       INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT public.effective_plan(plan, pro_expires_at) INTO v_plan
    FROM public.profiles WHERE id = auth.uid();

  SELECT count(*) INTO v_count FROM public.objects WHERE user_id = auth.uid();

  IF public.is_paid_plan(v_plan) THEN
    RETURN QUERY SELECT v_count, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT free_objects_max, free_photos_per_object
    INTO v_objects_max, v_photos
    FROM public.app_settings WHERE id = 1;

  RETURN QUERY SELECT v_count, v_objects_max, v_photos;
END;
$function$;

-- ── 7. Amélioration photo : ouverte au Pro, avec son propre quota ─
CREATE OR REPLACE FUNCTION public.get_photo_enhance_quota()
RETURNS TABLE(used INTEGER, quota INTEGER, reset_at TIMESTAMPTZ, is_premium BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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

  SELECT CASE WHEN v_plan = 'pro'
              THEN pro_photo_enhance_quota_monthly
              ELSE premium_photo_enhance_quota_monthly END
    INTO v_limit
    FROM public.app_settings WHERE id = 1;

  RETURN QUERY SELECT v_used, v_limit, v_reset_at, TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_and_increment_photo_enhance_quota()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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

  -- Libellé conservé pour ne pas casser les clients déjà déployés.
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

  SELECT CASE WHEN v_plan = 'pro'
              THEN pro_photo_enhance_quota_monthly
              ELSE premium_photo_enhance_quota_monthly END
    INTO v_limit
    FROM public.app_settings WHERE id = 1;

  IF v_used >= v_limit THEN
    INSERT INTO public.activity_log (user_id, action, payload)
    VALUES (auth.uid(), 'photo_enhance.quota_exceeded',
            jsonb_build_object('used', v_used, 'quota', v_limit, 'plan', v_plan));
    RETURN 'QUOTA_EXCEEDED';
  END IF;

  UPDATE public.profiles
     SET photo_enhance_used = photo_enhance_used + 1
   WHERE id = auth.uid();

  RETURN 'OK';
END;
$function$;
