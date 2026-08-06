-- ================================================================
-- 20260701234641_log_object_created.sql
-- Trace 'object.created' dans activity_log via un trigger sur
-- public.objects, pour capturer TOUTES les voies de création
-- (confirmation de draft IA, fiche vide manuelle, etc.) sans
-- dépendre de chaque point d'insertion côté client.
-- Le dashboard admin lit déjà activity_log génériquement, donc
-- aucun changement supplémentaire n'est nécessaire côté admin.tsx.
-- ================================================================

CREATE OR REPLACE FUNCTION public.log_object_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.activity_log (user_id, object_id, action, payload)
  VALUES (NEW.user_id, NEW.id, 'object.created', jsonb_build_object('title', NEW.title));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_object_created
AFTER INSERT ON public.objects
FOR EACH ROW EXECUTE FUNCTION public.log_object_created();
