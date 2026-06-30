-- ================================================================
-- 20260630030000_get_plan_limits_rpc.sql
-- get_plan_limits() : appelée depuis la page profil mobile pour
-- afficher les quotas restants (objets, photos/objet) en fonction
-- du plan de l'utilisateur et des valeurs courantes d'app_settings.
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_plan_limits()
RETURNS TABLE(objects_used INTEGER, objects_max INTEGER, photos_per_object INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_plan        TEXT;
  v_objects_max INTEGER;
  v_photos      INTEGER;
  v_count       INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT plan INTO v_plan FROM public.profiles WHERE id = auth.uid();

  SELECT count(*) INTO v_count FROM public.objects WHERE user_id = auth.uid();

  IF v_plan = 'premium' THEN
    RETURN QUERY SELECT v_count, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT free_objects_max, free_photos_per_object
    INTO v_objects_max, v_photos
    FROM public.app_settings WHERE id = 1;

  RETURN QUERY SELECT v_count, v_objects_max, v_photos;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_plan_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_plan_limits() TO authenticated;
