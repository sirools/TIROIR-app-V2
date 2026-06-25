-- ================================================================
-- 007_performance_rls.sql
-- Deux corrections post-advisors performance :
--
-- 1. auth_rls_initplan : remplacer auth.uid() par (SELECT auth.uid())
--    dans toutes les policies RLS → évaluation unique par requête
--    au lieu de une fois par ligne.
--
-- 2. unindexed_foreign_keys : ajouter les indexes manquants sur les
--    colonnes référencées par des FK composites ou simples sans index.
-- ================================================================

-- ── 1. Correction auth_rls_initplan ──────────────────────────────
-- Toutes les tables : DROP + RECREATE avec (SELECT auth.uid())

-- profiles
DROP POLICY IF EXISTS "profiles: select own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;

CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- drawers
DROP POLICY IF EXISTS "drawers: select own" ON public.drawers;
DROP POLICY IF EXISTS "drawers: update own" ON public.drawers;

CREATE POLICY "drawers: select own"
  ON public.drawers FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "drawers: update own"
  ON public.drawers FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- collections
DROP POLICY IF EXISTS "collections: select own" ON public.collections;
DROP POLICY IF EXISTS "collections: insert own" ON public.collections;
DROP POLICY IF EXISTS "collections: update own" ON public.collections;
DROP POLICY IF EXISTS "collections: delete own" ON public.collections;

CREATE POLICY "collections: select own"
  ON public.collections FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "collections: insert own"
  ON public.collections FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "collections: update own"
  ON public.collections FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "collections: delete own"
  ON public.collections FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- objects
DROP POLICY IF EXISTS "objects: select own" ON public.objects;

CREATE POLICY "objects: select own"
  ON public.objects FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- object_images
DROP POLICY IF EXISTS "object_images: select own" ON public.object_images;
DROP POLICY IF EXISTS "object_images: insert own" ON public.object_images;
DROP POLICY IF EXISTS "object_images: update own" ON public.object_images;
DROP POLICY IF EXISTS "object_images: delete own" ON public.object_images;

CREATE POLICY "object_images: select own"
  ON public.object_images FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "object_images: insert own"
  ON public.object_images FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.objects
      WHERE id = object_id AND user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "object_images: update own"
  ON public.object_images FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.objects
      WHERE id = object_id AND user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "object_images: delete own"
  ON public.object_images FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- conversations
DROP POLICY IF EXISTS "conversations: select own" ON public.conversations;
DROP POLICY IF EXISTS "conversations: insert own" ON public.conversations;
DROP POLICY IF EXISTS "conversations: update own" ON public.conversations;
DROP POLICY IF EXISTS "conversations: delete own" ON public.conversations;

CREATE POLICY "conversations: select own"
  ON public.conversations FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "conversations: insert own"
  ON public.conversations FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "conversations: update own"
  ON public.conversations FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "conversations: delete own"
  ON public.conversations FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- messages
DROP POLICY IF EXISTS "messages: select own" ON public.messages;

CREATE POLICY "messages: select own"
  ON public.messages FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ai_drafts
DROP POLICY IF EXISTS "ai_drafts: select own" ON public.ai_drafts;

CREATE POLICY "ai_drafts: select own"
  ON public.ai_drafts FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ai_draft_images
DROP POLICY IF EXISTS "ai_draft_images: select own" ON public.ai_draft_images;
DROP POLICY IF EXISTS "ai_draft_images: insert own" ON public.ai_draft_images;
DROP POLICY IF EXISTS "ai_draft_images: delete own" ON public.ai_draft_images;

CREATE POLICY "ai_draft_images: select own"
  ON public.ai_draft_images FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "ai_draft_images: insert own"
  ON public.ai_draft_images FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.ai_drafts
      WHERE id = draft_id
        AND user_id = (SELECT auth.uid())
        AND status IN ('uploading', 'pending')
    )
  );

CREATE POLICY "ai_draft_images: delete own"
  ON public.ai_draft_images FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ai_change_proposals
DROP POLICY IF EXISTS "ai_change_proposals: select own" ON public.ai_change_proposals;

CREATE POLICY "ai_change_proposals: select own"
  ON public.ai_change_proposals FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- activity_log
DROP POLICY IF EXISTS "activity_log: select own" ON public.activity_log;

CREATE POLICY "activity_log: select own"
  ON public.activity_log FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ── 2. Indexes manquants sur FK (unindexed_foreign_keys) ─────────

-- ai_change_proposals.conversation_id (FK simple sans index)
CREATE INDEX IF NOT EXISTS ai_change_proposals_conversation_id_idx
  ON public.ai_change_proposals (conversation_id)
  WHERE conversation_id IS NOT NULL;

-- ai_drafts.conversation_id
CREATE INDEX IF NOT EXISTS ai_drafts_conversation_id_idx
  ON public.ai_drafts (conversation_id)
  WHERE conversation_id IS NOT NULL;

-- ai_drafts.confirmed_object_id
CREATE INDEX IF NOT EXISTS ai_drafts_confirmed_object_id_idx
  ON public.ai_drafts (confirmed_object_id)
  WHERE confirmed_object_id IS NOT NULL;

-- messages.object_id (FK simple sans index)
CREATE INDEX IF NOT EXISTS messages_object_id_idx
  ON public.messages (object_id)
  WHERE object_id IS NOT NULL;
