-- ================================================================
-- 20260630010000_admin_flag.sql
-- profiles.is_admin : accès dashboard KPI admin (web)
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
