-- ================================================================
-- ai_credits_spend.sql — BROUILLON (strategie/offres.md, marche 2)
-- Les analyses IA puisent dans le quota du mois, puis dans les crédits.
--
-- À appliquer APRÈS ai_credits.sql. Additif : aucune fonction existante
-- n'est modifiée ; consume_ai_quota et ses raccourcis restent en place.
--
-- spend_ai_units(unités, fonction) :
--   1. le quota du mois suffit → il est débité (comportement actuel) ;
--   2. sinon, les crédits achetés suffisent → ils sont débités ;
--   3. sinon → refus, avec le solde de crédits pour l'afficher.
-- Le retour dit d'où vient la dépense, pour la rendre si l'IA échoue
-- (refund_ai_spend).
--
-- À la bascule (marche 6), mettre le quota gratuit mensuel à 0 dans
-- app_settings suffit : tout passe alors par les crédits.
-- ================================================================

CREATE OR REPLACE FUNCTION public.spend_ai_units(p_units INTEGER, p_feature TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_units INTEGER := GREATEST(1, LEAST(100, COALESCE(p_units, 1)));
  v_id    UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  IF public.consume_ai_quota(v_units) THEN
    RETURN jsonb_build_object('ok', true, 'source', 'quota', 'units', v_units);
  END IF;

  v_id := public.consume_ai_credits(v_units, left(COALESCE(p_feature, ''), 60));
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'source', 'credits', 'units', v_units, 'ledger_id', v_id);
  END IF;

  RETURN jsonb_build_object('ok', false, 'units', v_units, 'credits', public.ai_credit_balance(auth.uid()));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spend_ai_units(INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_ai_units(INTEGER, TEXT) TO authenticated;

-- Rend une dépense quand l'IA n'a rien produit. Côté crédits : une seule
-- fois, et seulement une dépense de l'appelant (refund_ai_credits).
CREATE OR REPLACE FUNCTION public.refund_ai_spend(p_spend JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF p_spend ->> 'source' = 'credits' AND p_spend ? 'ledger_id' THEN
    PERFORM public.refund_ai_credits((p_spend ->> 'ledger_id')::UUID);
  ELSIF p_spend ->> 'source' = 'quota' THEN
    PERFORM public.refund_ai_quota_units(COALESCE((p_spend ->> 'units')::INTEGER, 1));
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refund_ai_spend(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_ai_spend(JSONB) TO authenticated;
