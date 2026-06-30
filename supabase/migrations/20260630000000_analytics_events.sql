-- ================================================================
-- 20260630000000_analytics_events.sql
-- Complète activity_log (déjà alimentée par draft.confirmed,
-- object.updated, object.deleted) avec les 2 events serveur
-- manquants au funnel freemium : account.created, quota.exceeded.
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.drawers (user_id, name)
  VALUES (NEW.id, 'Mon Tiroir')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.activity_log (user_id, action, payload)
  VALUES (NEW.id, 'account.created', '{}'::jsonb);

  RETURN NEW;
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
    INSERT INTO public.activity_log (user_id, action, payload)
    VALUES (auth.uid(), 'quota.exceeded', jsonb_build_object('used', v_used, 'quota', v_limit));
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
     SET ai_analyses_used = ai_analyses_used + 1
   WHERE id = auth.uid();

  RETURN TRUE;
END;
$$;
