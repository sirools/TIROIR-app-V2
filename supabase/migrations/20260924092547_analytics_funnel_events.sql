-- ================================================================
-- 20260924100000_analytics_funnel_events.sql
-- Complète le funnel dans activity_log (V4 — Mesure) :
--   * jalons produit : milestone.first_object / milestone.tenth_object
--     (émis par le trigger de création d'objet, toutes voies confondues)
--   * log_client_event : RPC SECURITY DEFINER pour les events déclenchés
--     côté client (ex. paywall.viewed), avec whitelist stricte.
-- Additif : aucune colonne retirée, aucune donnée réécrite.
-- ================================================================

-- 1) Jalons 1er / 10e objet, ajoutés au trigger existant object.created.
CREATE OR REPLACE FUNCTION public.log_object_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  INSERT INTO public.activity_log (user_id, object_id, action, payload)
  VALUES (NEW.user_id, NEW.id, 'object.created', jsonb_build_object('title', NEW.title));

  SELECT count(*) INTO v_count
    FROM public.objects
   WHERE user_id = NEW.user_id;

  IF v_count = 1 THEN
    INSERT INTO public.activity_log (user_id, object_id, action, payload)
    VALUES (NEW.user_id, NEW.id, 'milestone.first_object', '{}'::jsonb);
  ELSIF v_count = 10 THEN
    INSERT INTO public.activity_log (user_id, object_id, action, payload)
    VALUES (NEW.user_id, NEW.id, 'milestone.tenth_object', '{}'::jsonb);
  END IF;

  RETURN NEW;
END;
$$;

-- 2) RPC pour les events client (whitelist). Le client n'a que le droit
--    de SELECT sur activity_log ; cette fonction insère en son nom sur
--    un ensemble fermé d'actions, pour éviter tout log arbitraire.
CREATE OR REPLACE FUNCTION public.log_client_event(
  p_action  TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF p_action NOT IN ('paywall.viewed') THEN
    RAISE EXCEPTION 'Action non autorisée: %', p_action;
  END IF;

  INSERT INTO public.activity_log (user_id, action, payload)
  VALUES (auth.uid(), p_action, COALESCE(p_payload, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.log_client_event(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_event(TEXT, JSONB) TO authenticated;
