-- ================================================================
-- 008_composite_fk_indexes.sql
-- Index composites pour couvrir les FK (object_id, user_id) etc.
-- Clôture les 7 alertes INFO unindexed_foreign_keys.
-- ================================================================

CREATE INDEX IF NOT EXISTS objects_collection_id_user_id_idx
  ON public.objects (collection_id, user_id)
  WHERE collection_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS object_images_object_id_user_id_idx
  ON public.object_images (object_id, user_id);

CREATE INDEX IF NOT EXISTS collections_drawer_id_user_id_idx
  ON public.collections (drawer_id, user_id);

CREATE INDEX IF NOT EXISTS conversations_context_object_id_user_id_idx
  ON public.conversations (context_object_id, user_id)
  WHERE context_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_conversation_id_user_id_idx
  ON public.messages (conversation_id, user_id);

CREATE INDEX IF NOT EXISTS ai_draft_images_draft_id_user_id_idx
  ON public.ai_draft_images (draft_id, user_id);

CREATE INDEX IF NOT EXISTS ai_change_proposals_object_id_user_id_idx
  ON public.ai_change_proposals (object_id, user_id);
