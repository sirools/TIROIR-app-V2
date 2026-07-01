-- ================================================================
-- 20260702030000_admin_infra_cost_tracking.sql
-- Dashboard admin V1 : jauges d'usage infra Supabase (DB + Storage
-- vs limites du plan, pilotables) et estimation des coûts IA
-- (Claude analyses + Gemini retouches), avec seuil d'alerte.
-- ================================================================

ALTER TABLE public.app_settings
  ADD COLUMN supabase_db_limit_mb INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN supabase_storage_limit_mb INTEGER NOT NULL DEFAULT 1024,
  ADD COLUMN estimated_cost_per_ai_analysis_usd NUMERIC(10,4) NOT NULL DEFAULT 0.01,
  ADD COLUMN estimated_cost_per_photo_enhance_usd NUMERIC(10,4) NOT NULL DEFAULT 0.039,
  ADD COLUMN monthly_ai_spend_alert_usd NUMERIC(10,2) NOT NULL DEFAULT 50;

-- ── get_admin_infra_stats ────────────────────────────────────────
-- Taille DB + Storage en octets, et compteurs "depuis le lancement"
-- (ai_drafts traités par chat-turn, images -enhanced. générées par
-- Gemini). Accès restreint : ni PUBLIC ni authenticated, seul le
-- service_role (dashboard admin) peut l'appeler.

CREATE OR REPLACE FUNCTION public.get_admin_infra_stats()
RETURNS TABLE(
  db_size_bytes BIGINT,
  storage_size_bytes BIGINT,
  ai_analyses_lifetime BIGINT,
  photo_enhance_lifetime BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, storage
AS $$
BEGIN
  RETURN QUERY SELECT
    pg_database_size(current_database()),
    (SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)::bigint FROM storage.objects),
    (SELECT COUNT(*) FROM public.ai_drafts WHERE status <> 'uploading'),
    (SELECT COUNT(*) FROM public.object_images WHERE storage_path LIKE '%-enhanced.%');
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_infra_stats() FROM PUBLIC, anon, authenticated;
