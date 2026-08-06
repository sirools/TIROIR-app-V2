-- ================================================================
-- 20260806221854_multi_add_feature_flag.sql
-- app_settings.multi_add_audience + get_feature_flags()
--
-- Drapeau d'accès à la capture multi-objets. Le principe arrêté : ouvrir la
-- fonctionnalité à un segment doit être un CHANGEMENT DE CONFIG, pas une
-- release soumise à la revue App Store. D'où une valeur en base plutôt
-- qu'une constante dans le bundle.
--
-- Le drapeau ne protège QUE la capture par détection — coûteuse en tokens.
-- Le champ Quantité, lui, est ouvert à tous depuis le début : il n'a aucune
-- inconnue technique et sert de test d'appétence.
--
-- get_feature_flags() renvoie des booléens déjà calculés : l'arbitrage
-- audience × plan × admin reste côté serveur. Le client ne reçoit pas de
-- quoi le rejouer, donc pas de quoi le contourner.
--
-- `is_admin` l'emporte toujours : le compte de test doit pouvoir essayer la
-- fonctionnalité quelle que soit l'audience configurée.
-- ================================================================

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS multi_add_audience TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_multi_add_audience_valid;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_multi_add_audience_valid
  CHECK (multi_add_audience IN ('admin', 'pro', 'premium', 'all'));

COMMENT ON COLUMN public.app_settings.multi_add_audience IS
  'Qui accede a la capture multi-objets : admin (defaut), pro, premium, all. Ouvrir la fonctionnalite est un changement de config, pas une release.';

CREATE OR REPLACE FUNCTION public.get_feature_flags()
RETURNS TABLE(multi_add BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_audience TEXT;
  v_plan     TEXT;
  v_admin    BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT s.multi_add_audience INTO v_audience FROM public.app_settings s WHERE s.id = 1;
  SELECT p.plan, p.is_admin INTO v_plan, v_admin FROM public.profiles p WHERE p.id = auth.uid();

  RETURN QUERY SELECT CASE COALESCE(v_audience, 'admin')
    WHEN 'all'     THEN TRUE
    WHEN 'premium' THEN COALESCE(v_admin, FALSE) OR v_plan IN ('premium', 'pro')
    WHEN 'pro'     THEN COALESCE(v_admin, FALSE) OR v_plan = 'pro'
    ELSE COALESCE(v_admin, FALSE)
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_feature_flags() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_feature_flags() TO authenticated;
