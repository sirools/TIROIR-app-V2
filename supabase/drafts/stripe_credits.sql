-- ================================================================
-- stripe_credits.sql — crédits IA achetés sur le site (Stripe). Version
-- finale du 08/11/2026, rejouable, aucune donnée existante modifiée.
--
-- À appliquer APRÈS ai_credits.sql et ai_credits_spend.sql : l'historique
-- ci-dessous lit ai_spends.
--
-- Seule opération qui retire quelque chose : la règle « reason » du
-- journal ai_credit_ledger est élargie au motif « reversal ». Une règle
-- CHECK ne s'élargit pas sur place : elle est remplacée, dans une seule
-- instruction, et seulement si elle ne connaît pas encore « reversal »
-- (rejouer le script ne la touche plus). Aucune ligne n'est modifiée ;
-- les lignes existantes sont revérifiées par la nouvelle règle, plus large.
--
-- Le journal reste ai_credit_ledger (en prod depuis le 30/09/2026) : un
-- deuxième journal « credit_ledger » ferait deux soldes. Correspondance
-- avec le brief :
--   achat          → reason 'purchase'  (+, ref « stripe:<session> » ou « rc:<transaction> »)
--   consommation   → reason 'consume'   (−, via spend_ai)
--   remboursement  → reason 'reversal'  (−, NOUVEAU : reprise des crédits
--                    après un remboursement Stripe, charge.refunded)
--   quota mensuel  → table ai_spends, source 'quota' (le quota du mois
--                    n'est pas un solde : il se remet à zéro chaque mois)
-- 'refund' (+) reste le crédit rendu quand l'IA a échoué.
--
-- ADDITIF : aucune ligne existante ne change, aucun quota ne change.
-- Sécurité : tout s'écrit côté serveur (service_role) ; un compte ne lit
-- que ses propres achats et son propre historique.
-- ================================================================

-- ── 1. Nouvelle raison : reprise après remboursement (négative) ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ai_credit_ledger'::regclass
                  AND conname = 'ai_credit_ledger_reason_check' AND pg_get_constraintdef(oid) LIKE '%reversal%') THEN
    ALTER TABLE public.ai_credit_ledger
      DROP CONSTRAINT IF EXISTS ai_credit_ledger_reason_check,
      ADD CONSTRAINT ai_credit_ledger_reason_check
        CHECK (reason IN ('welcome', 'purchase', 'gift', 'admin', 'consume', 'refund', 'reversal'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ai_credit_ledger'::regclass
                  AND conname = 'ai_credit_ledger_sign' AND pg_get_constraintdef(oid) LIKE '%reversal%') THEN
    ALTER TABLE public.ai_credit_ledger
      DROP CONSTRAINT IF EXISTS ai_credit_ledger_sign,
      ADD CONSTRAINT ai_credit_ledger_sign CHECK (
        (reason IN ('consume', 'reversal') AND delta < 0) OR (reason NOT IN ('consume', 'reversal') AND delta > 0)
      );
  END IF;
END $$;
-- Une reprise ne compte qu'une fois (ref : « stripe:<payment_intent>:<total repris> »).
CREATE UNIQUE INDEX IF NOT EXISTS ai_credit_ledger_reversal_once_idx
  ON public.ai_credit_ledger (reason, ref)
  WHERE ref IS NOT NULL AND reason = 'reversal';

-- ── 2. Événements Stripe déjà traités (idempotence du webhook) ───
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id           TEXT        PRIMARY KEY,           -- evt_…
  type         TEXT        NOT NULL,
  livemode     BOOLEAN     NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error        TEXT
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_events FROM PUBLIC, anon, authenticated;

-- ── 3. Achats de crédits sur le site ─────────────────────────────
-- Une ligne par session Checkout payée. Gardée même si le compte est
-- supprimé (user_id → NULL) : c'est une pièce comptable.
CREATE TABLE IF NOT EXISTS public.stripe_credit_purchases (
  checkout_session_id TEXT        PRIMARY KEY,      -- cs_…
  payment_intent_id   TEXT        UNIQUE,           -- pi_…
  user_id             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email      TEXT,
  pack                TEXT        NOT NULL,         -- clé du pack (web/lib/stripeConfig.ts)
  credits             INTEGER     NOT NULL CHECK (credits > 0),
  amount_total        INTEGER     NOT NULL CHECK (amount_total >= 0),  -- centimes TTC
  currency            TEXT        NOT NULL DEFAULT 'eur',
  payment_method      TEXT,                          -- card, link, sepa_debit…
  livemode            BOOLEAN     NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'paid'
                      CHECK (status IN ('paid', 'partially_refunded', 'refunded')),
  amount_refunded     INTEGER     NOT NULL DEFAULT 0,
  credits_reversed    INTEGER     NOT NULL DEFAULT 0,
  paid_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stripe_credit_purchases_user_idx ON public.stripe_credit_purchases (user_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS stripe_credit_purchases_paid_idx ON public.stripe_credit_purchases (paid_at DESC);
ALTER TABLE public.stripe_credit_purchases ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stripe_credit_purchases' AND policyname = 'stripe_credit_purchases: select own') THEN
    CREATE POLICY "stripe_credit_purchases: select own" ON public.stripe_credit_purchases
      FOR SELECT USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.stripe_credit_purchases FROM PUBLIC, anon, authenticated;

-- ── 4. Enregistrer un achat et créditer (serveur seulement) ──────
-- Atomique et idempotent : rejouer le même événement ne crédite rien de
-- plus (grant_ai_credits refuse une deuxième fois la même référence).
-- Renvoie vrai si le compte vient d'être crédité.
CREATE OR REPLACE FUNCTION public.record_stripe_credit_purchase(
  p_session_id TEXT, p_payment_intent TEXT, p_user_id UUID, p_email TEXT,
  p_pack TEXT, p_credits INTEGER, p_amount_total INTEGER, p_currency TEXT,
  p_payment_method TEXT, p_livemode BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_session_id IS NULL OR p_session_id = '' THEN RAISE EXCEPTION 'Session manquante'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Compte manquant'; END IF;

  INSERT INTO public.stripe_credit_purchases (
    checkout_session_id, payment_intent_id, user_id, customer_email, pack, credits,
    amount_total, currency, payment_method, livemode
  ) VALUES (
    p_session_id, NULLIF(p_payment_intent, ''), p_user_id, p_email, p_pack, p_credits,
    p_amount_total, COALESCE(p_currency, 'eur'), p_payment_method, p_livemode
  )
  ON CONFLICT (checkout_session_id) DO NOTHING;

  RETURN public.grant_ai_credits(p_user_id, p_credits, 'purchase', 'stripe:' || p_session_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_stripe_credit_purchase(TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

-- ── 5. Remboursement Stripe → reprise des crédits (serveur) ──────
-- p_amount_refunded : montant CUMULÉ remboursé sur le paiement (le champ
-- amount_refunded de la charge). Remboursement total : tous les crédits
-- du pack ; partiel : au prorata, arrondi à l'inférieur. Rejouer le même
-- événement, ou recevoir les événements dans le désordre, ne reprend
-- jamais deux fois.
-- Le solde peut passer sous zéro si les crédits ont déjà été dépensés :
-- l'IA payante est alors bloquée jusqu'au prochain achat.
-- Renvoie le nombre de crédits repris maintenant, NULL si le paiement
-- n'est pas un achat de crédits (facture Business, par exemple).
CREATE OR REPLACE FUNCTION public.reverse_stripe_credit_purchase(p_payment_intent TEXT, p_amount_refunded INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v      public.stripe_credit_purchases%ROWTYPE;
  v_refd INTEGER;
  v_tgt  INTEGER;
  v_delta INTEGER;
BEGIN
  SELECT * INTO v FROM public.stripe_credit_purchases
   WHERE payment_intent_id = p_payment_intent FOR UPDATE;
  IF v.checkout_session_id IS NULL THEN RETURN NULL; END IF;

  v_refd := GREATEST(v.amount_refunded, COALESCE(p_amount_refunded, 0));
  v_tgt := CASE
    WHEN v_refd >= v.amount_total THEN v.credits
    ELSE floor(v.credits::NUMERIC * v_refd / NULLIF(v.amount_total, 0))::INTEGER
  END;
  v_delta := GREATEST(0, COALESCE(v_tgt, 0) - v.credits_reversed);

  IF v_delta > 0 AND v.user_id IS NOT NULL THEN
    INSERT INTO public.ai_credit_ledger (user_id, delta, reason, ref)
    VALUES (v.user_id, -v_delta, 'reversal', 'stripe:' || p_payment_intent || ':' || v_tgt)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.stripe_credit_purchases SET
    amount_refunded  = v_refd,
    credits_reversed = GREATEST(credits_reversed, COALESCE(v_tgt, 0)),
    status = CASE WHEN v_refd >= amount_total THEN 'refunded' WHEN v_refd > 0 THEN 'partially_refunded' ELSE 'paid' END
  WHERE checkout_session_id = v.checkout_session_id;

  RETURN v_delta;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reverse_stripe_credit_purchase(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- ── 6. Historique du compte (lui seul) ───────────────────────────
-- Mouvements du journal + dépenses prises sur le quota du mois, du plus
-- récent au plus ancien. Le quota n'entre pas dans le solde.
CREATE OR REPLACE FUNCTION public.get_my_credit_history(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (at TIMESTAMPTZ, delta INTEGER, reason TEXT, detail TEXT, refunded BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT * FROM (
    SELECT l.created_at, l.delta, l.reason,
           CASE WHEN l.reason = 'consume' THEN l.ref
                WHEN l.ref LIKE 'stripe:%' THEN 'site'
                WHEN l.ref LIKE 'rc:%' THEN 'app'
           END,
           false
      FROM public.ai_credit_ledger l
     WHERE l.user_id = auth.uid()
    UNION ALL
    SELECT s.created_at, -s.units, 'quota', s.feature, s.refunded_at IS NOT NULL
      FROM public.ai_spends s
     WHERE s.user_id = auth.uid() AND s.source = 'quota'
  ) h
  ORDER BY 1 DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_credit_history(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_credit_history(INTEGER) TO authenticated;

COMMENT ON TABLE public.stripe_credit_purchases IS
  'Achats de crédits IA sur le site (Stripe Checkout). Le crédit lui-même est dans ai_credit_ledger.';
COMMENT ON TABLE public.stripe_events IS
  'Événements Stripe reçus par /api/stripe/webhook : un événement n''est traité qu''une fois.';
