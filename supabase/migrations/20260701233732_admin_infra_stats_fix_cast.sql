-- ================================================================
-- 20260701233732_admin_infra_stats_fix_cast.sql
-- Correctif de cast sur get_admin_infra_stats() : SUM() sur le champ
-- metadata->>'size' de storage.objects renvoie un NUMERIC, incompatible
-- avec le BIGINT déclaré en sortie. D'où le ::bigint explicite.
--
-- ⚠ FICHIER RECONSTITUÉ depuis l'historique de la base le 2026-08-06.
-- Ce correctif avait été appliqué à chaud sans être redescendu dans le
-- dépôt : rejouer les migrations sur une base vierge produisait donc un
-- schéma différent de la production. Le SQL ci-dessous est exactement
-- celui enregistré dans supabase_migrations.schema_migrations.
-- ================================================================

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
