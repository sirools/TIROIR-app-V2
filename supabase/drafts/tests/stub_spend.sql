-- Quota mensuel minimal, même contrat que la prod (consume_ai_quota,
-- refund_ai_quota_units), pour tester spend_ai_units. Base jetable.
CREATE TABLE public.profiles (id uuid PRIMARY KEY, ai_analyses_used int NOT NULL DEFAULT 0, ai_limit int NOT NULL DEFAULT 10);
INSERT INTO auth.users VALUES ('cccccccc-0000-0000-0000-000000000000');
INSERT INTO public.profiles (id) VALUES ('cccccccc-0000-0000-0000-000000000000'), ('bbbbbbbb-0000-0000-0000-000000000000');
CREATE FUNCTION public.consume_ai_quota(p_units int) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_used int; v_limit int;
BEGIN
  SELECT ai_analyses_used, ai_limit INTO v_used, v_limit FROM public.profiles WHERE id = auth.uid();
  IF v_used + p_units > v_limit THEN RETURN false; END IF;
  UPDATE public.profiles SET ai_analyses_used = ai_analyses_used + p_units WHERE id = auth.uid();
  RETURN true;
END; $$;
CREATE FUNCTION public.refund_ai_quota_units(p_units int) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  UPDATE public.profiles SET ai_analyses_used = GREATEST(0, ai_analyses_used - p_units) WHERE id = auth.uid();
$$;
