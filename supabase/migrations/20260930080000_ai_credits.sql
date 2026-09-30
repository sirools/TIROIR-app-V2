-- ================================================================
-- 20260930080000_ai_credits.sql — appliqué en prod le 30/09/2026 (strategie/offres.md, marche 1)
-- Solde de crédits IA par compte, et son journal.
--
-- ADDITIF : aucune table existante n'est modifiée, aucun quota ne change.
-- Rien ne consomme encore ces crédits (marche 2) et rien ne les vend
-- encore (marche 3). À appliquer sur la prod puis à renommer dans
-- supabase/migrations/ avec la version enregistrée (voir leur README).
--
-- Principe : un JOURNAL, jamais un compteur qu'on écrase. Chaque ligne est
-- un mouvement (+ achat, cadeau, remboursement ; − consommation) ; le
-- solde est leur somme. On sait toujours d'où vient chaque crédit.
--
-- Sécurité :
--   - un compte ne lit que son propre journal, n'y écrit jamais directement ;
--   - il ne peut que DÉPENSER ses crédits (consume_ai_credits) ou se faire
--     rendre une dépense précise, une seule fois (refund_ai_credits) ;
--   - créditer (achat, cadeau) est réservé au serveur (service_role), avec
--     une référence unique : un même achat ne crédite jamais deux fois.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.ai_credit_ledger (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta       INTEGER     NOT NULL CHECK (delta <> 0),
  reason      TEXT        NOT NULL CHECK (reason IN ('welcome', 'purchase', 'gift', 'admin', 'consume', 'refund')),
  -- Achat : identifiant de transaction du store ; remboursement : id de la
  -- consommation rendue ; consommation : fonction IA appelante.
  ref         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_credit_ledger_sign CHECK (
    (reason = 'consume' AND delta < 0) OR (reason <> 'consume' AND delta > 0)
  )
);

CREATE INDEX IF NOT EXISTS ai_credit_ledger_user_idx ON public.ai_credit_ledger (user_id, created_at DESC);

-- Un achat, un cadeau ou un remboursement ne compte qu'une fois.
CREATE UNIQUE INDEX IF NOT EXISTS ai_credit_ledger_once_idx
  ON public.ai_credit_ledger (reason, ref)
  WHERE ref IS NOT NULL AND reason IN ('purchase', 'gift', 'refund', 'welcome');

ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_credit_ledger: select own" ON public.ai_credit_ledger;
CREATE POLICY "ai_credit_ledger: select own" ON public.ai_credit_ledger
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Aucune écriture directe, pour personne d'autre que le serveur.
REVOKE INSERT, UPDATE, DELETE ON public.ai_credit_ledger FROM PUBLIC, anon, authenticated;

-- ── Solde ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ai_credit_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(SUM(delta), 0)::INTEGER FROM public.ai_credit_ledger WHERE user_id = p_user_id;
$$;
REVOKE EXECUTE ON FUNCTION public.ai_credit_balance(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_ai_credits()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  RETURN public.ai_credit_balance(auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_ai_credits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_ai_credits() TO authenticated;

-- ── Dépenser (l'appelant, pour lui-même) ─────────────────────────
-- Renvoie l'id du mouvement (à garder pour un éventuel remboursement), ou
-- NULL si le solde ne suffit pas : rien n'est alors débité.
CREATE OR REPLACE FUNCTION public.consume_ai_credits(p_amount INTEGER, p_feature TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100 THEN RAISE EXCEPTION 'Montant invalide'; END IF;

  -- Deux dépenses simultanées ne peuvent pas passer sous zéro.
  PERFORM pg_advisory_xact_lock(hashtext('ai_credits:' || v_uid::TEXT));
  IF public.ai_credit_balance(v_uid) < p_amount THEN RETURN NULL; END IF;

  INSERT INTO public.ai_credit_ledger (user_id, delta, reason, ref)
  VALUES (v_uid, -p_amount, 'consume', left(COALESCE(p_feature, ''), 60))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_ai_credits(INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(INTEGER, TEXT) TO authenticated;

-- ── Rendre une dépense (IA en échec) ─────────────────────────────
-- Seulement une dépense de l'appelant, seulement une fois, pour son
-- montant exact. Renvoie vrai si le remboursement a eu lieu.
CREATE OR REPLACE FUNCTION public.refund_ai_credits(p_consume_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_delta INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  SELECT delta INTO v_delta FROM public.ai_credit_ledger
   WHERE id = p_consume_id AND user_id = v_uid AND reason = 'consume';
  IF v_delta IS NULL THEN RETURN FALSE; END IF;

  INSERT INTO public.ai_credit_ledger (user_id, delta, reason, ref)
  VALUES (v_uid, -v_delta, 'refund', p_consume_id::TEXT)
  ON CONFLICT DO NOTHING;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refund_ai_credits(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_ai_credits(UUID) TO authenticated;

-- ── Créditer (serveur seulement) ─────────────────────────────────
-- Achat (webhook des stores), crédits de bienvenue, cadeau, geste admin.
-- p_ref unique par raison : rejouer le même achat ne crédite rien de plus.
-- Renvoie vrai si le compte a été crédité.
CREATE OR REPLACE FUNCTION public.grant_ai_credits(p_user_id UUID, p_amount INTEGER, p_reason TEXT, p_ref TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  IF p_reason NOT IN ('welcome', 'purchase', 'gift', 'admin') THEN RAISE EXCEPTION 'Raison invalide'; END IF;
  IF p_reason IN ('purchase', 'gift', 'welcome') AND (p_ref IS NULL OR p_ref = '') THEN
    RAISE EXCEPTION 'Référence obligatoire';
  END IF;

  INSERT INTO public.ai_credit_ledger (user_id, delta, reason, ref)
  VALUES (p_user_id, p_amount, p_reason, NULLIF(p_ref, ''))
  ON CONFLICT DO NOTHING;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.grant_ai_credits(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.ai_credit_ledger IS
  'Journal des crédits IA (strategie/offres.md) : le solde est la somme des mouvements.';
