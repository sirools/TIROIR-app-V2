-- Colonnes de palier de la prod (profiles.plan, pro_*) et effective_plan(),
-- pour tester business_billing.sql. Base jetable.
INSERT INTO auth.users VALUES ('dddddddd-0000-0000-0000-000000000000'), ('eeeeeeee-0000-0000-0000-000000000000');
INSERT INTO public.profiles (id) VALUES ('aaaaaaaa-0000-0000-0000-000000000000'), ('dddddddd-0000-0000-0000-000000000000'), ('eeeeeeee-0000-0000-0000-000000000000');
ALTER TABLE public.profiles
  ADD COLUMN plan text NOT NULL DEFAULT 'free',
  ADD COLUMN pro_since date, ADD COLUMN pro_expires_at date,
  ADD COLUMN pro_invoice_ref text, ADD COLUMN pro_company text;
CREATE FUNCTION public.effective_plan(p_plan text, p_pro_expires_at date) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_plan = 'pro' AND p_pro_expires_at IS NOT NULL AND p_pro_expires_at < CURRENT_DATE THEN 'free' ELSE p_plan END;
$$;
