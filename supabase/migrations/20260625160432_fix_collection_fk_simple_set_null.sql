-- ================================================================
-- 20260625160432_fix_collection_fk_simple_set_null.sql
-- Correctif de la migration précédente : la FK composite
-- (collection_id, user_id) empêchait le SET NULL simple. On revient
-- à une FK simple sur collection_id uniquement.
-- ================================================================

ALTER TABLE public.objects
  DROP CONSTRAINT IF EXISTS objects_collection_id_fkey;

ALTER TABLE public.objects
  ADD CONSTRAINT objects_collection_id_fkey
  FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS objects_collection_id_user_id_idx
  ON public.objects (collection_id, user_id) WHERE collection_id IS NOT NULL;
