-- ================================================================
-- ai_credits_spend.sql — dépense IA par quota puis crédits (strategie/offres.md,
-- marches 2 et 2 bis). Version finale du 08/11/2026 : sans DROP, rejouable,
-- aucune donnée existante modifiée (une table, des fonctions, des droits retirés).
-- Toute dépense IA passe par ici : le quota du mois d'abord, puis les
-- crédits achetés. Et un remboursement n'est plus jamais à la main du
-- compte lui-même.
--
-- À appliquer APRÈS ai_credits.sql, puis redéployer AUSSITÔT les fonctions
-- detect-scene, describe-object, chat-turn, enhance-object-photo,
-- scene-thumbnail et estimate-value (voir supabase/drafts/README.md).
--
-- Trou corrigé : refund_ai_quota, refund_ai_quota_units,
-- refund_photo_enhance_quota et refund_value_estimate_quota étaient
-- appelables par le compte : il pouvait remettre ses compteurs du mois à
-- zéro et utiliser l'IA sans limite. Ils ne le sont plus. Un remboursement
-- ne se fait que par refund_ai_spend, réservé au serveur (service_role),
-- sur une dépense enregistrée, une seule fois.
-- ================================================================

-- ── Journal des dépenses ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_spends (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature     TEXT        NOT NULL,
  kind        TEXT        NOT NULL CHECK (kind IN ('analysis', 'photo', 'estimate')),
  source      TEXT        NOT NULL CHECK (source IN ('quota', 'credits')),
  units       INTEGER     NOT NULL CHECK (units > 0),
  ledger_id   UUID        REFERENCES public.ai_credit_ledger(id),
  refunded_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_spends_user_idx ON public.ai_spends (user_id, created_at DESC);
ALTER TABLE public.ai_spends ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_spends' AND policyname = 'ai_spends: select own') THEN
    CREATE POLICY "ai_spends: select own" ON public.ai_spends
      FOR SELECT USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.ai_spends FROM PUBLIC, anon, authenticated;

-- ── Famille et prix en crédits d'une fonction IA ─────────────────
CREATE OR REPLACE FUNCTION public.ai_feature_kind(p_feature TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT CASE p_feature
    WHEN 'detect_scene'    THEN 'analysis'
    WHEN 'describe_object' THEN 'analysis'
    WHEN 'chat_turn'       THEN 'analysis'
    WHEN 'enhance_photo'   THEN 'photo'
    WHEN 'scene_thumbnail' THEN 'photo'
    WHEN 'estimate_value'  THEN 'estimate'
  END;
$$;

-- Coût en crédits (strategie/offres.md) : une analyse coûte son poids en
-- unités ; une image générée 4 ; une estimation avec recherche web 8.
CREATE OR REPLACE FUNCTION public.ai_credit_cost(p_kind TEXT, p_units INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT CASE p_kind WHEN 'analysis' THEN p_units WHEN 'photo' THEN 4 WHEN 'estimate' THEN 8 END;
$$;

-- ── Dépenser (le compte, pour lui-même) ──────────────────────────
-- Renvoie { ok, source, spend_id, kind, units } ; en cas de refus
-- { ok: false, reason: 'QUOTA_EXCEEDED' | 'NOT_PREMIUM', credits, cost }.
CREATE OR REPLACE FUNCTION public.spend_ai(p_feature TEXT, p_units INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_kind   TEXT := public.ai_feature_kind(p_feature);
  v_units  INTEGER;
  v_quota  TEXT;
  v_ok     BOOLEAN;
  v_cost   INTEGER;
  v_ledger UUID;
  v_id     UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'Fonction IA inconnue : %', p_feature; END IF;
  v_units := CASE WHEN v_kind = 'analysis' THEN GREATEST(1, LEAST(100, COALESCE(p_units, 1))) ELSE 1 END;

  -- 1. Le quota du mois.
  IF v_kind = 'analysis' THEN
    v_ok := public.consume_ai_quota(v_units);
    v_quota := CASE WHEN v_ok THEN 'OK' ELSE 'QUOTA_EXCEEDED' END;
  ELSIF v_kind = 'photo' THEN
    v_quota := public.check_and_increment_photo_enhance_quota();
  ELSE
    v_quota := public.check_and_increment_value_estimate_quota();
  END IF;

  IF v_quota = 'OK' THEN
    INSERT INTO public.ai_spends (user_id, feature, kind, source, units)
    VALUES (v_uid, p_feature, v_kind, 'quota', v_units) RETURNING id INTO v_id;
    RETURN jsonb_build_object('ok', true, 'source', 'quota', 'spend_id', v_id, 'kind', v_kind, 'units', v_units);
  END IF;

  -- 2. Les crédits achetés (y compris pour un compte gratuit, à qui la
  --    retouche photo était jusqu'ici fermée).
  v_cost := public.ai_credit_cost(v_kind, v_units);
  v_ledger := public.consume_ai_credits(v_cost, p_feature);
  IF v_ledger IS NOT NULL THEN
    INSERT INTO public.ai_spends (user_id, feature, kind, source, units, ledger_id)
    VALUES (v_uid, p_feature, v_kind, 'credits', v_cost, v_ledger) RETURNING id INTO v_id;
    RETURN jsonb_build_object('ok', true, 'source', 'credits', 'spend_id', v_id, 'kind', v_kind, 'units', v_cost);
  END IF;

  -- 3. Refus.
  RETURN jsonb_build_object(
    'ok', false,
    'reason', CASE WHEN v_quota = 'NOT_PREMIUM' THEN 'NOT_PREMIUM' ELSE 'QUOTA_EXCEEDED' END,
    'credits', public.ai_credit_balance(v_uid),
    'cost', v_cost
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spend_ai(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_ai(TEXT, INTEGER) TO authenticated;

-- ── Rendre une dépense (serveur seulement) ───────────────────────
-- Appelé par la fonction IA, avec la clé service, quand le modèle n'a rien
-- produit. Une seule fois par dépense. Renvoie vrai si rendu.
CREATE OR REPLACE FUNCTION public.refund_ai_spend(p_spend_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_row public.ai_spends%ROWTYPE;
BEGIN
  UPDATE public.ai_spends SET refunded_at = now()
   WHERE id = p_spend_id AND refunded_at IS NULL
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RETURN FALSE; END IF;

  IF v_row.source = 'credits' THEN
    INSERT INTO public.ai_credit_ledger (user_id, delta, reason, ref)
    VALUES (v_row.user_id, v_row.units, 'refund', v_row.ledger_id::TEXT)
    ON CONFLICT DO NOTHING;
  ELSIF v_row.kind = 'analysis' THEN
    UPDATE public.profiles SET ai_analyses_used = GREATEST(0, ai_analyses_used - v_row.units) WHERE id = v_row.user_id;
  ELSIF v_row.kind = 'photo' THEN
    UPDATE public.profiles SET photo_enhance_used = GREATEST(0, photo_enhance_used - 1) WHERE id = v_row.user_id;
  ELSE
    UPDATE public.profiles SET value_estimate_used = GREATEST(0, value_estimate_used - 1) WHERE id = v_row.user_id;
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refund_ai_spend(UUID) FROM PUBLIC, anon, authenticated;

-- ── Fermer le trou : plus de remboursement à la main du compte ───
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.refund_ai_quota()',
    'public.refund_ai_quota_units(integer)',
    'public.refund_photo_enhance_quota()',
    'public.refund_value_estimate_quota()'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.ai_spends IS
  'Dépenses IA (quota ou crédits), remboursables une fois par le serveur (strategie/offres.md).';
