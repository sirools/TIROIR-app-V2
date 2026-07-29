-- ================================================================
-- 20260729120000_supabase_pro_plan_quotas.sql
-- Passage du projet au plan Supabase Pro : mise à jour des limites
-- suivies par le dashboard admin, et ajout du suivi de l'Egress —
-- le seul quota Pro réellement contraignant pour une app photo,
-- et le seul qui n'est pas lisible depuis Postgres (relevé manuel
-- depuis la page Usage de l'organisation).
--
-- Quotas plan Pro (tarifs Supabase, juillet 2026) :
--   Disque / projet ...... 8 Go inclus,      puis 0,125 $ / Go
--   Storage .............. 100 Go inclus,    puis 0,021 $ / Go
--   Egress (non caché) ... 250 Go inclus,    puis 0,09 $ / Go
--   MAU .................. 100 000 inclus    (hors de portée ici)
--   Edge functions ....... 2 M invocations   (hors de portée ici)
-- ================================================================

ALTER TABLE public.app_settings
  ADD COLUMN supabase_plan_monthly_usd NUMERIC(10,2) NOT NULL DEFAULT 25,
  ADD COLUMN supabase_egress_limit_gb INTEGER NOT NULL DEFAULT 250,
  ADD COLUMN supabase_egress_used_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN supabase_egress_reading_date DATE;

-- Nouvelles valeurs par défaut : plan Pro au lieu du plan Free
ALTER TABLE public.app_settings
  ALTER COLUMN supabase_db_limit_mb SET DEFAULT 8192,
  ALTER COLUMN supabase_storage_limit_mb SET DEFAULT 102400;

-- Ligne de configuration existante : bascule Free → Pro
UPDATE public.app_settings
SET supabase_db_limit_mb = 8192,
    supabase_storage_limit_mb = 102400
WHERE id = 1;
