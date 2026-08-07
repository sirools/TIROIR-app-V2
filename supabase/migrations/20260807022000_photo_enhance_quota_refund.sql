-- ================================================================
-- 20260807022000_photo_enhance_quota_refund.sql
-- Rendre le jeton quand l'image n'a pas ete produite.
--
-- Le quota est preleve AVANT l'appel au modele — il le faut, sinon rien
-- n'empeche d'enchainer les tentatives. Mais quand Gemini repond 5xx trois
-- fois de suite, l'utilisateur repart avec un compteur decremente et aucune
-- image : il paie une panne de fournisseur. Constate sur la premiere
-- generation de vignette de scene, ou trois tentatives ont echoue.
--
-- La fonction est volontairement bornee a zero et sans argument : elle ne
-- peut que rendre UN jeton a l'appelant, jamais en crediter.
-- ================================================================

CREATE OR REPLACE FUNCTION public.refund_photo_enhance_quota()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  UPDATE public.profiles
     SET photo_enhance_used = GREATEST(0, photo_enhance_used - 1)
   WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_photo_enhance_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_photo_enhance_quota() TO authenticated;

COMMENT ON FUNCTION public.refund_photo_enhance_quota() IS
  'Rend un jeton de quota retouche/vignette quand la generation a echoue. Bornee a zero.';
