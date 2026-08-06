-- ================================================================
-- 20260630203456_get_plan_limits_rpc.sql
-- Révision de get_plan_limits() : le plan premium ne renvoie plus de
-- plafond du tout (NULL) au lieu des valeurs de app_settings.
--
-- ⚠ FICHIER RECONSTITUÉ depuis l'historique de la base le 2026-08-06.
-- Cette migration avait été appliquée sans être redescendue dans le
-- dépôt. Le SQL ci-dessous est exactement celui enregistré dans
-- supabase_migrations.schema_migrations.
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
