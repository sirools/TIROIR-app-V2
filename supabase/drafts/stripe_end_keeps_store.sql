-- stripe_end_keeps_store.sql — la fin d'un abonnement du site ne retire
-- plus un abonnement des stores payé en parallèle (audit du 09/11/2026).
--
-- Cas corrigé : un compte s'abonne sur le site, puis achète aussi un
-- abonnement dans l'app (le webhook RevenueCat l'ignore, le palier venant
-- du site ; il le note dans public.subscriptions). Quand l'abonnement du
-- site s'arrête, le compte retombait en gratuit alors que le store est
-- payé, jusqu'au renouvellement suivant (un an pour un annuel).
-- Désormais : s'il reste un abonnement Apple ou Google actif dans
-- public.subscriptions, le compte prend son palier (le plus haut, Pro
-- avant Premium) avec plan_source = 'app'.
--
-- SCRIPT FINAL, prêt pour la prod (à n'appliquer qu'avec l'accord de
-- Clément). Non destructif : aucun DROP, aucune table ni colonne touchée,
-- aucune donnée modifiée ; seul le corps de apply_stripe_subscription
-- change (CREATE OR REPLACE, même signature, mêmes droits). Rejouable :
-- deux passages donnent le même résultat. Même comportement qu'avant en
-- dehors du cas ci-dessus. Prérequis :
-- supabase/migrations/20261108130727_stripe_subscriptions.sql (en prod).
-- Tests : tests/stripe_end_keeps_store.test.sql (tests/run.sh).
--
-- Avant : sauvegarde de la prod (preprod/sauvegarde/sauvegarde-base.sh,
-- ou au minimum la définition actuelle, déjà relevée dans
-- rollback/stripe_end_keeps_store.rollback.sql).
-- Après : vérifier que la fonction contient v_store_tier :
--   SELECT pg_get_functiondef('public.apply_stripe_subscription(uuid,text,text,text,text,timestamptz,boolean,boolean,text)'::regprocedure) LIKE '%v_store_tier%';
-- Retour arrière : rollback/stripe_end_keeps_store.rollback.sql.

DO $$ BEGIN
  IF to_regclass('public.subscriptions') IS NULL THEN
    RAISE EXCEPTION 'public.subscriptions absente : appliquer d''abord 20261108130727_stripe_subscriptions.sql';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription(
  p_user_id              UUID,
  p_customer_id          TEXT,
  p_subscription_id      TEXT,
  p_plan                 TEXT,
  p_status               TEXT,
  p_period_end           TIMESTAMPTZ,
  p_cancel_at_period_end BOOLEAN,
  p_livemode             BOOLEAN,
  p_period               TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  p        public.profiles%ROWTYPE;
  v_live   BOOLEAN := p_status IN ('active', 'trialing', 'past_due');
  v_kept   BOOLEAN;
  v_store_tier TEXT;
BEGIN
  IF p_plan NOT IN ('premium', 'pro') THEN RAISE EXCEPTION 'Palier invalide : %', p_plan; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'ignoré (compte inconnu)'; END IF;

  -- Journal, toutes sources (y compris un ancien abonnement qui s'arrête).
  INSERT INTO public.subscriptions (user_id, source, external_id, tier, period, status, current_period_end, cancel_at_period_end)
  VALUES (p_user_id, 'stripe', p_subscription_id, p_plan, p_period, p_status, p_period_end, COALESCE(p_cancel_at_period_end, false))
  ON CONFLICT (source, external_id) DO UPDATE SET
    tier = EXCLUDED.tier, period = COALESCE(EXCLUDED.period, subscriptions.period), status = EXCLUDED.status,
    current_period_end = EXCLUDED.current_period_end, cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    user_id = EXCLUDED.user_id, updated_at = now();

  -- Un ancien abonnement qui s'arrête n'écrase pas le courant.
  IF NOT v_live AND p.stripe_subscription_id IS NOT NULL AND p.stripe_subscription_id <> p_subscription_id
     AND p.subscription_status IN ('active', 'trialing', 'past_due') THEN
    RETURN 'ignoré (ancien abonnement)';
  END IF;

  -- Pro sur facture ou par une organisation, encore valide : on garde.
  v_kept := p.pro_invoice_ref IS NOT NULL AND public.effective_plan(p.plan, p.pro_expires_at) = 'pro';

  UPDATE public.profiles SET
    stripe_customer_id                = COALESCE(p_customer_id, stripe_customer_id),
    stripe_livemode                   = p_livemode,
    stripe_subscription_id            = p_subscription_id,
    subscription_status               = p_status,
    subscription_period_end           = p_period_end,
    subscription_cancel_at_period_end = COALESCE(p_cancel_at_period_end, false)
  WHERE id = p_user_id;

  IF v_live THEN
    IF v_kept THEN RETURN 'abonnement noté, Pro existant gardé'; END IF;
    UPDATE public.profiles SET
      plan = p_plan, plan_source = 'web',
      -- Restes d'un ancien Pro sur facture, échu : effacés.
      pro_since = NULL, pro_expires_at = NULL, pro_invoice_ref = NULL, pro_company = NULL
    WHERE id = p_user_id
      AND (plan IS DISTINCT FROM p_plan OR plan_source IS DISTINCT FROM 'web' OR pro_expires_at IS NOT NULL OR pro_invoice_ref IS NOT NULL);
    RETURN p_plan || ' (' || p_status || ')';
  END IF;

  IF p.plan_source = 'web' AND NOT v_kept THEN
    -- Abonnement des stores encore payé : il prend le relais.
    SELECT s.tier INTO v_store_tier FROM public.subscriptions s
     WHERE s.user_id = p_user_id AND s.source IN ('apple', 'google')
       AND s.status IN ('active', 'past_due')
       AND (s.current_period_end IS NULL OR s.current_period_end > now())
     ORDER BY (s.tier = 'pro') DESC LIMIT 1;
    IF v_store_tier IS NOT NULL THEN
      UPDATE public.profiles SET plan = v_store_tier, plan_source = 'app' WHERE id = p_user_id;
      RETURN v_store_tier || ' (abonnement de l''app gardé)';
    END IF;
    UPDATE public.profiles SET plan = 'free', plan_source = NULL WHERE id = p_user_id;
    RETURN 'gratuit (' || p_status || ')';
  END IF;
  RETURN 'abonnement ' || p_status || ', palier inchangé';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_stripe_subscription(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;
