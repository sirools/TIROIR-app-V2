-- ================================================================
-- 20260625160213_collections_fk_set_null_on_delete.sql
-- Supprimer une collection ne doit plus bloquer/cascader sur ses objets :
-- objects.collection_id passe à NULL au lieu d'être contraint.
-- ================================================================

ALTER TABLE public.objects
  DROP CONSTRAINT IF EXISTS objects_collection_id_fkey;

ALTER TABLE public.objects
  ADD CONSTRAINT objects_collection_id_fkey
  FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE SET NULL;
