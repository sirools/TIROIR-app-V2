-- ================================================================
-- 20260807030000_refund_ai_quota.sql
-- Rendre le jeton d'analyse quand le modele n'a rien produit.
--
-- Meme raison que refund_photo_enhance_quota (20260807022000) : le quota
-- est preleve avant l'appel, sinon rien n'empeche d'enchainer les
-- tentatives. Mais une erreur du fournisseur ou un refus du modele ne
-- doit pas consommer une analyse du mois.
--
-- Bornee a zero, sans argument : elle ne peut que rendre UN jeton a
-- l'appelant, jamais en crediter.
-- ================================================================

CREATE OR REPLACE FUNCTION public.refund_ai_quota()
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
     SET ai_analyses_used = GREATEST(0, ai_analyses_used - 1)
   WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_ai_quota() TO authenticated;

COMMENT ON FUNCTION public.refund_ai_quota() IS
  'Rend un jeton d analyse IA quand la generation a echoue. Bornee a zero.';
