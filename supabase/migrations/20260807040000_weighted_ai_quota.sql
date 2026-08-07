-- ================================================================
-- 20260807040000_weighted_ai_quota.sql
-- Quota IA pondere : toutes les analyses ne coutent pas la meme chose.
--
-- Le compteur montait de 1 par analyse, quel que soit le travail demande.
-- C'etait juste tant qu'il n'existait qu'une analyse, a 1 c. Ce n'est plus
-- vrai : une detection de scene coute 0,58 c en Haiku et 12,5 c en Opus,
-- soit un rapport de 1 a 21 sous le meme compteur.
--
-- Pire, detect-scene ne consommait RIEN. Tant que la fonctionnalite est
-- derriere le drapeau admin cela ne se voit pas ; le jour ou elle s'ouvre,
-- un utilisateur peut enchainer des analyses Opus sans jamais rien
-- decompter. C'est le trou que ces fonctions bouchent.
--
-- consume_ai_quota() reprend mot pour mot la logique de
-- check_and_increment_ai_quota() en place (override par compte, periode
-- configurable, plafond par plan) : seul le pas change. L'ancienne
-- signature reste appelable et delegue avec un poids de 1, pour que les
-- fonctions Edge deja deployees continuent de tourner pendant le
-- redeploiement. Rien n'est supprime.
--
-- get_ai_quota() n'est PAS touchee : elle rend deja le bon plafond.
-- ================================================================

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_units INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_used     INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_plan     TEXT;
  v_override INTEGER;
  v_period   TEXT;
  v_limit    INTEGER;
  -- Borne haute de securite : un poids aberrant (bug d'appelant) ne doit
  -- pas vider le quota d'un mois en un appel.
  v_units    INTEGER := GREATEST(1, LEAST(100, COALESCE(p_units, 1)));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT ai_analyses_used, ai_quota_reset_at,
         public.effective_plan(plan, pro_expires_at), ai_quota_override, ai_quota_period
    INTO v_used, v_reset_at, v_plan, v_override, v_period
    FROM public.profiles
   WHERE id = auth.uid();

  IF now() >= v_reset_at THEN
    UPDATE public.profiles
       SET ai_analyses_used  = 0,
           ai_quota_reset_at = public.next_ai_quota_reset(v_period)
     WHERE id = auth.uid();
    v_used := 0;
  END IF;

  v_limit := public.effective_ai_quota(v_override, v_plan);

  -- Le lot entier est verifie, pas l'unite : accepter une analyse a
  -- 13 unites avec 3 unites restantes ferait passer le compteur au-dela
  -- du plafond sans que personne ne l'ait decide.
  IF v_used + v_units > v_limit THEN
    INSERT INTO public.activity_log (user_id, action, payload)
    VALUES (
      auth.uid(),
      'quota.exceeded',
      jsonb_build_object('used', v_used, 'requested', v_units, 'quota', v_limit, 'plan', v_plan)
    );
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
     SET ai_analyses_used = ai_analyses_used + v_units
   WHERE id = auth.uid();

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_ai_quota(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(INTEGER) TO authenticated;

COMMENT ON FUNCTION public.consume_ai_quota(INTEGER) IS
  'Consomme p_units du quota d analyses. false si le solde ne suffit pas. Le poids reflete le cout reel du modele appele.';

-- ── Restitution ponderee ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refund_ai_quota_units(p_units INTEGER)
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
     SET ai_analyses_used = GREATEST(0, ai_analyses_used - GREATEST(1, LEAST(100, COALESCE(p_units, 1))))
   WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_ai_quota_units(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_ai_quota_units(INTEGER) TO authenticated;

-- ── Les anciennes signatures deviennent des raccourcis ────────────

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_quota()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT public.consume_ai_quota(1);
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_quota() TO authenticated;

CREATE OR REPLACE FUNCTION public.refund_ai_quota()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT public.refund_ai_quota_units(1);
$$;

REVOKE EXECUTE ON FUNCTION public.refund_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_ai_quota() TO authenticated;
