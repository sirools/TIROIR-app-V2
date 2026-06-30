-- ================================================================
-- 20260625163122_add_object_value_fields.sql
-- Valeur de marché / valeur déclarée par l'utilisateur (feature
-- "prix de marché" : recherche d'annonces similaires)
-- ================================================================

ALTER TABLE public.objects
  ADD COLUMN IF NOT EXISTS market_value       NUMERIC     NULL,
  ADD COLUMN IF NOT EXISTS user_value         NUMERIC     NULL,
  ADD COLUMN IF NOT EXISTS value_currency     TEXT        NOT NULL DEFAULT '€',
  ADD COLUMN IF NOT EXISTS value_estimated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS value_sources      JSONB       NULL;
