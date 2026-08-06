-- ================================================================
-- 20260806224553_ai_usage_real_tokens.sql
-- ai_usage : consommation IA RÉELLE, tokens mesurés et non estimés.
--
-- Le suivi de coût existant est un forfait déclaré à la main
-- (app_settings.estimated_cost_per_ai_analysis_usd = 0,01 $). Il vaut pour
-- une analyse mono ; il ne peut PAS refléter une analyse de scène, où
-- l'image est plus dense et la sortie plus longue (N objets × attributs).
-- Comptée au même forfait, la détection multi-objets apparaîtrait au même
-- prix qu'un ajout unitaire — et on piloterait à l'aveugle exactement la
-- fonctionnalité dont on veut surveiller la gourmandise.
--
-- D'où des tokens réels, dès le premier appel : sur une fonctionnalité au
-- coût inconnu, un forfait ne vaut rien.
--
-- Écriture réservée au service_role : seules les Edge Functions alimentent
-- cette table. Lecture par le propriétaire, et par l'admin pour tous.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'detect_scene' | 'chat_turn' | 'estimate_value' | ...
  feature                     TEXT        NOT NULL,
  model                       TEXT        NOT NULL,
  input_tokens                INTEGER     NOT NULL DEFAULT 0,
  output_tokens               INTEGER     NOT NULL DEFAULT 0,
  cache_read_input_tokens     INTEGER     NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER     NOT NULL DEFAULT 0,
  -- Calculé à l'écriture depuis les tarifs du modèle : un tarif change,
  -- l'historique déjà écrit reste juste.
  cost_usd                    NUMERIC(12,6),
  duration_ms                 INTEGER,
  -- Contexte libre : nombre d'objets détectés, taille d'image, scène…
  meta                        JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx    ON public.ai_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_feature_created_idx ON public.ai_usage (feature, created_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads own usage" ON public.ai_usage;
CREATE POLICY "owner reads own usage"
  ON public.ai_usage FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin reads all usage" ON public.ai_usage;
CREATE POLICY "admin reads all usage"
  ON public.ai_usage FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

REVOKE INSERT, UPDATE, DELETE ON public.ai_usage FROM anon, authenticated;

COMMENT ON TABLE public.ai_usage IS
  'Consommation IA reelle, tokens mesures et non estimes. app_settings.estimated_cost_per_ai_analysis_usd reste un forfait declare a la main : il ne peut pas refleter une analyse de scene, plus lourde qu une analyse mono.';
