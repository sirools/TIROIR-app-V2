-- Quotas minimaux, même contrat que la prod (consume_ai_quota,
-- check_and_increment_photo_enhance_quota, check_and_increment_value_estimate_quota
-- et leurs refund_* appelables par le compte, comme aujourd'hui). Base jetable.
INSERT INTO auth.users VALUES ('cccccccc-0000-0000-0000-000000000000');
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, paid bool NOT NULL DEFAULT false,
  ai_analyses_used int NOT NULL DEFAULT 0, ai_limit int NOT NULL DEFAULT 10,
  photo_enhance_used int NOT NULL DEFAULT 0, photo_limit int NOT NULL DEFAULT 1,
  value_estimate_used int NOT NULL DEFAULT 0, estimate_limit int NOT NULL DEFAULT 1
);
INSERT INTO public.profiles (id) VALUES ('cccccccc-0000-0000-0000-000000000000'), ('bbbbbbbb-0000-0000-0000-000000000000');
GRANT SELECT ON public.profiles TO authenticated;
CREATE FUNCTION public.consume_ai_quota(p_units int) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_used int; v_limit int;
BEGIN
  SELECT ai_analyses_used, ai_limit INTO v_used, v_limit FROM public.profiles WHERE id = auth.uid();
  IF v_used + p_units > v_limit THEN RETURN false; END IF;
  UPDATE public.profiles SET ai_analyses_used = ai_analyses_used + p_units WHERE id = auth.uid();
  RETURN true;
END; $$;
CREATE FUNCTION public.check_and_increment_photo_enhance_quota() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE p public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF NOT p.paid THEN RETURN 'NOT_PREMIUM'; END IF;
  IF p.photo_enhance_used >= p.photo_limit THEN RETURN 'QUOTA_EXCEEDED'; END IF;
  UPDATE public.profiles SET photo_enhance_used = photo_enhance_used + 1 WHERE id = auth.uid();
  RETURN 'OK';
END; $$;
CREATE FUNCTION public.check_and_increment_value_estimate_quota() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE p public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF p.value_estimate_used >= p.estimate_limit THEN RETURN 'QUOTA_EXCEEDED'; END IF;
  UPDATE public.profiles SET value_estimate_used = value_estimate_used + 1 WHERE id = auth.uid();
  RETURN 'OK';
END; $$;
CREATE FUNCTION public.refund_ai_quota_units(p_units int) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  UPDATE public.profiles SET ai_analyses_used = GREATEST(0, ai_analyses_used - p_units) WHERE id = auth.uid();
$$;
CREATE FUNCTION public.refund_ai_quota() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$ SELECT public.refund_ai_quota_units(1); $$;
CREATE FUNCTION public.refund_photo_enhance_quota() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  UPDATE public.profiles SET photo_enhance_used = GREATEST(0, photo_enhance_used - 1) WHERE id = auth.uid();
$$;
CREATE FUNCTION public.refund_value_estimate_quota() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  UPDATE public.profiles SET value_estimate_used = GREATEST(0, value_estimate_used - 1) WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.refund_ai_quota_units(int), public.refund_ai_quota(), public.refund_photo_enhance_quota(), public.refund_value_estimate_quota() TO authenticated;
