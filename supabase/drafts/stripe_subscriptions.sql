-- ================================================================
-- stripe_subscriptions.sql — BROUILLON (abonnements Premium et Pro
-- vendus sur le site par Stripe, comptes particuliers)
--
-- Après stripe_credits.sql (table stripe_events) et business_billing.sql.
--
-- Un compte qui s'abonne sur le site garde son palier dans
-- profiles.plan, comme un abonné des stores : toutes les fonctions qui
-- lisent effective_plan() le voient sans changement. On ajoute :
--   - l'identifiant du client et de l'abonnement Stripe ;
--   - le statut Stripe (active, trialing, past_due, canceled, unpaid…),
--     la fin de la période en cours, la résiliation programmée ;
--   - plan_source : d'où vient le palier payant (web = Stripe, app =
--     achats intégrés via RevenueCat). Prépare la synchronisation avec
--     les stores : un webhook ne retire jamais un palier venu de l'autre.
--
-- Écritures : uniquement par apply_stripe_subscription(), appelée par le
-- webhook Stripe (clé service). Aucun compte ne peut écrire ces colonnes
-- (UPDATE sur profiles déjà retiré à anon et authenticated, sauf
-- colonnes listées : 20260926140000_profiles_update_columns.sql).
--
-- ADDITIF : des colonnes et une fonction, rien de supprimé.
-- ================================================================

-- ── 1. Colonnes ──────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id                TEXT,
  ADD COLUMN IF NOT EXISTS stripe_livemode                   BOOLEAN,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id            TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status               TEXT,
  ADD COLUMN IF NOT EXISTS subscription_period_end           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_source                       TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_source_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_source_check CHECK (plan_source IS NULL OR plan_source IN ('web', 'app'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_id_key
  ON public.profiles (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_stripe_subscription_id_idx
  ON public.profiles (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.stripe_customer_id IS
  'Client Stripe du compte (abonnement sur le site). Créé au premier paiement, pas à l''inscription.';
COMMENT ON COLUMN public.profiles.stripe_livemode IS
  'Mode Stripe du client (false = test). Un client de test n''est jamais réutilisé en mode réel.';
COMMENT ON COLUMN public.profiles.subscription_status IS
  'Statut Stripe de l''abonnement du site : active, trialing, past_due (en retard, accès gardé), canceled, unpaid…';
COMMENT ON COLUMN public.profiles.subscription_period_end IS
  'Fin de la période payée en cours (abonnement du site).';
COMMENT ON COLUMN public.profiles.plan_source IS
  'Origine du palier payant : web (Stripe) ou app (achats intégrés, RevenueCat). NULL : gratuit, ou attribué à la main / par une organisation.';

-- ── 1 bis. Journal des abonnements, toutes sources ───────────────
-- Une ligne par abonnement : Stripe (site), Apple ou Google (stores, via
-- RevenueCat). Le palier lu par l'app reste profiles.plan (effective_plan) :
-- ce journal dit d'où il vient, avec statut et fin de période, sans rien
-- changer aux comptes existants (abonnés des stores, Premium faits à la
-- main). Écrit par le serveur seul ; chaque compte lit ses lignes.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source               TEXT        NOT NULL CHECK (source IN ('stripe', 'apple', 'google')),
  external_id          TEXT        NOT NULL,           -- sub_… ou transaction d'origine du store
  tier                 TEXT        NOT NULL CHECK (tier IN ('premium', 'pro')),
  period               TEXT        CHECK (period IN ('monthly', 'yearly')),
  status               TEXT        NOT NULL,           -- active, trialing, past_due, canceled, expired…
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions (user_id);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
DROP POLICY IF EXISTS subscriptions_own_read ON public.subscriptions;
CREATE POLICY subscriptions_own_read ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Abonnement d'un store (RevenueCat) : noté dans le journal. Ne touche pas
-- au palier (le webhook RevenueCat s'en charge, comme avant).
CREATE OR REPLACE FUNCTION public.upsert_store_subscription(
  p_user_id UUID, p_source TEXT, p_external_id TEXT, p_tier TEXT, p_period TEXT,
  p_status TEXT, p_period_end TIMESTAMPTZ, p_cancel_at_period_end BOOLEAN
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  INSERT INTO public.subscriptions (user_id, source, external_id, tier, period, status, current_period_end, cancel_at_period_end)
  SELECT p_user_id, p_source, p_external_id, p_tier, p_period, p_status, p_period_end, COALESCE(p_cancel_at_period_end, false)
   WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id)
  ON CONFLICT (source, external_id) DO UPDATE SET
    tier = EXCLUDED.tier, period = COALESCE(EXCLUDED.period, subscriptions.period), status = EXCLUDED.status,
    current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
    cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = now();
$$;
REVOKE EXECUTE ON FUNCTION public.upsert_store_subscription(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

-- ── 2. Le compte peut-il ouvrir un abonnement sur le site ? ──────
-- Lu par /api/stripe/subscription (clé service) avant de créer la
-- session Checkout. 'OK', 'WEB' (déjà abonné sur le site : portail),
-- 'OTHER' (palier payant venu de l'app, d'une facture ou d'une
-- organisation : on ne vend pas un second abonnement).
CREATE OR REPLACE FUNCTION public.stripe_subscription_gate(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p.id IS NULL THEN 'UNKNOWN'
    WHEN p.plan_source = 'web' AND p.subscription_status IN ('active', 'trialing', 'past_due') THEN 'WEB'
    WHEN public.effective_plan(p.plan, p.pro_expires_at) <> 'free' THEN 'OTHER'
    ELSE 'OK'
  END
  FROM (SELECT 1) one
  LEFT JOIN public.profiles p ON p.id = p_user_id;
$$;
REVOKE EXECUTE ON FUNCTION public.stripe_subscription_gate(UUID) FROM PUBLIC, anon, authenticated;

-- ── 3. Client Stripe rattaché au compte ──────────────────────────
-- Un seul client par compte et par mode : on garde le premier posé.
-- Renvoie l'identifiant retenu (celui qui était déjà là, le cas échéant).
CREATE OR REPLACE FUNCTION public.set_stripe_customer(p_user_id UUID, p_customer_id TEXT, p_livemode BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_current TEXT;
  v_mode    BOOLEAN;
BEGIN
  SELECT stripe_customer_id, stripe_livemode INTO v_current, v_mode
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte inconnu'; END IF;
  IF v_current IS NOT NULL AND v_mode IS NOT DISTINCT FROM p_livemode THEN RETURN v_current; END IF;
  UPDATE public.profiles
     SET stripe_customer_id = p_customer_id, stripe_livemode = p_livemode,
         -- Changement de mode (test → réel) : l'ancien abonnement de test n'existe plus.
         stripe_subscription_id = CASE WHEN v_current IS NULL THEN stripe_subscription_id END,
         subscription_status    = CASE WHEN v_current IS NULL THEN subscription_status END
   WHERE id = p_user_id;
  RETURN p_customer_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_stripe_customer(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ── 4. État d'un abonnement Stripe → palier du compte ────────────
-- Appelée par le webhook avec l'état ACTUEL de l'abonnement (relu chez
-- Stripe) : rejouer un événement, ou les recevoir dans le désordre,
-- donne le même résultat. Renvoie ce qui a été fait (journal).
--
--   active, trialing, past_due → palier payant (past_due = en retard :
--     l'accès est gardé pendant les relances de Stripe) ;
--   canceled, unpaid, incomplete, incomplete_expired, paused → retour au
--     gratuit, seulement si le palier venait de CET abonnement du site.
--
-- Ne touche jamais :
--   - un Pro attribué à la main ou par une organisation, encore valide
--     (pro_invoice_ref) : l'abonnement est noté, le palier reste ;
--   - un palier venu de l'app (plan_source = 'app') quand l'abonnement
--     du site s'arrête ;
--   - l'abonnement courant, quand c'est un ancien qui s'arrête.
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
    UPDATE public.profiles SET plan = 'free', plan_source = NULL WHERE id = p_user_id;
    RETURN 'gratuit (' || p_status || ')';
  END IF;
  RETURN 'abonnement ' || p_status || ', palier inchangé';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_stripe_subscription(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;
