-- ================================================================
-- 20260625102813_collection_icon.sql
-- Personnalisation visuelle des collections (emoji + couleur)
-- ================================================================

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS emoji      TEXT NOT NULL DEFAULT '📦',
  ADD COLUMN IF NOT EXISTS icon_color TEXT NOT NULL DEFAULT '#E8F0E0';
