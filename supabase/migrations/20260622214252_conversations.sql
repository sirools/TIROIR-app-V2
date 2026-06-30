-- ================================================================
-- 003_conversations.sql
-- conversations · messages · ai_drafts · ai_draft_images
-- ai_change_proposals
--
-- Renforts d'intégrité :
--   · conversations  : UNIQUE(id, user_id) + FK composite context_object_id
--   · messages       : FK composite conversation_id (même user)
--   · ai_change_proposals : UNIQUE(id, user_id) + FK composite object_id
--
-- Note sur context_object_id nullable :
--   La FK composite utilise MATCH SIMPLE (défaut PostgreSQL) :
--   si context_object_id IS NULL, la contrainte n'est pas évaluée.
--   L'ON DELETE SET NULL n'est pas utilisé car il nullifierait aussi
--   user_id (NOT NULL). La suppression d'un objet doit passer par
--   delete_object() qui nettoie context_object_id au préalable.
-- ================================================================

-- ── conversations ─────────────────────────────────────────────────

CREATE TABLE public.conversations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- context_object_id sans FK inline : FK composite ajoutée après
  context_object_id UUID,
  title             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_id_user_id_key UNIQUE (id, user_id)
);

-- FK composite : empêche qu'un utilisateur référence l'objet d'un autre
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_context_object_user_fk
    FOREIGN KEY (context_object_id, user_id)
    REFERENCES public.objects(id, user_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX conversations_user_id_idx ON public.conversations (user_id);
CREATE INDEX conversations_context_object_id_idx
  ON public.conversations (context_object_id)
  WHERE context_object_id IS NOT NULL;

CREATE POLICY "conversations: select own"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "conversations: insert own"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations: update own"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations: delete own"
  ON public.conversations FOR DELETE
  USING (auth.uid() = user_id);

-- ── messages ──────────────────────────────────────────────────────
-- Écriture réservée à chat-turn (service_role). SELECT client seul.
-- FK composite conversation_id : garantit qu'un message appartient
-- à une conversation du même utilisateur.

CREATE TABLE public.messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- conversation_id sans FK inline : FK composite ajoutée après
  conversation_id UUID        NOT NULL,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL
                                CHECK (role IN ('user','assistant','tool_call','tool_result')),
  content         TEXT,
  metadata        JSONB,
  object_id       UUID        REFERENCES public.objects(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK composite : garantit que conversation_id appartient au même user
ALTER TABLE public.messages
  ADD CONSTRAINT messages_conversation_user_fk
    FOREIGN KEY (conversation_id, user_id)
    REFERENCES public.conversations(id, user_id)
    ON DELETE CASCADE;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX messages_conversation_id_idx ON public.messages (conversation_id);
CREATE INDEX messages_user_id_idx         ON public.messages (user_id);

CREATE POLICY "messages: select own"
  ON public.messages FOR SELECT
  USING (auth.uid() = user_id);

-- ── ai_drafts ─────────────────────────────────────────────────────
-- Cycle de vie : uploading → pending → confirmed | rejected | expired
--
--   uploading : draft créé par begin_draft_capture(), upload photos en cours
--   pending   : chat-turn a analysé les photos et rempli proposed_data
--   confirmed : confirm_draft() appelé, objet créé
--   rejected  : reject_draft() appelé par l'utilisateur
--   expired   : expires_at dépassé au moment de confirm_draft()
--
-- Écriture réservée à begin_draft_capture() et chat-turn (service_role).
-- SELECT client seul.

CREATE TABLE public.ai_drafts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id     UUID        REFERENCES public.conversations(id) ON DELETE SET NULL,
  proposed_data       JSONB       NOT NULL DEFAULT '{}',
  status              TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN (
                                      'uploading','pending','confirmed','rejected','expired'
                                    )),
  confirmed_object_id UUID        REFERENCES public.objects(id) ON DELETE SET NULL,
  confirmed_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_drafts_id_user_id_key UNIQUE (id, user_id)
);

ALTER TABLE public.ai_drafts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_ai_drafts_updated_at
  BEFORE UPDATE ON public.ai_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX ai_drafts_user_id_idx ON public.ai_drafts (user_id);
CREATE INDEX ai_drafts_status_idx
  ON public.ai_drafts (status)
  WHERE status IN ('uploading', 'pending');

CREATE POLICY "ai_drafts: select own"
  ON public.ai_drafts FOR SELECT
  USING (auth.uid() = user_id);

-- ── ai_draft_images ───────────────────────────────────────────────
-- Chemin Storage : {user_id}/drafts/{draft_id}/{image_id}.ext
-- INSERT/DELETE autorisés au client pour le dépôt de photos.
-- Lignes supprimées par confirm_draft() après migration vers object_images.

CREATE TABLE public.ai_draft_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id     UUID        NOT NULL,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  mime_type    TEXT        NOT NULL
                             CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/heic')),
  size_bytes   INTEGER     CHECK (size_bytes IS NULL OR size_bytes > 0),
  position     INTEGER     NOT NULL DEFAULT 0
                             CHECK (position >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_draft_images_storage_path_key UNIQUE (storage_path)
);

-- FK composite : garantit que draft_id appartient au même user
ALTER TABLE public.ai_draft_images
  ADD CONSTRAINT ai_draft_images_draft_user_fk
    FOREIGN KEY (draft_id, user_id)
    REFERENCES public.ai_drafts(id, user_id)
    ON DELETE CASCADE;

ALTER TABLE public.ai_draft_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX ai_draft_images_draft_id_idx ON public.ai_draft_images (draft_id);
CREATE INDEX ai_draft_images_user_id_idx  ON public.ai_draft_images (user_id);

CREATE POLICY "ai_draft_images: select own"
  ON public.ai_draft_images FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT autorisé si le draft est en statut uploading ou pending
CREATE POLICY "ai_draft_images: insert own"
  ON public.ai_draft_images FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.ai_drafts
      WHERE id = draft_id
        AND user_id = auth.uid()
        AND status IN ('uploading', 'pending')
    )
  );

CREATE POLICY "ai_draft_images: delete own"
  ON public.ai_draft_images FOR DELETE
  USING (auth.uid() = user_id);

-- ── ai_change_proposals ───────────────────────────────────────────
-- Écriture réservée à chat-turn (service_role). SELECT client seul.
-- FK composite object_id : empêche la référence croisée d'utilisateurs.

CREATE TABLE public.ai_change_proposals (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id  UUID        REFERENCES public.conversations(id) ON DELETE SET NULL,
  -- object_id sans FK inline : FK composite ajoutée après
  object_id        UUID        NOT NULL,
  proposed_changes JSONB       NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','confirmed','rejected')),
  confirmed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_change_proposals_id_user_id_key UNIQUE (id, user_id)
);

-- FK composite : empêche qu'un utilisateur référence l'objet d'un autre
ALTER TABLE public.ai_change_proposals
  ADD CONSTRAINT ai_change_proposals_object_user_fk
    FOREIGN KEY (object_id, user_id)
    REFERENCES public.objects(id, user_id)
    ON DELETE CASCADE;

ALTER TABLE public.ai_change_proposals ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_ai_change_proposals_updated_at
  BEFORE UPDATE ON public.ai_change_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX ai_change_proposals_user_id_idx   ON public.ai_change_proposals (user_id);
CREATE INDEX ai_change_proposals_object_id_idx ON public.ai_change_proposals (object_id);
CREATE INDEX ai_change_proposals_status_idx
  ON public.ai_change_proposals (status)
  WHERE status = 'pending';

CREATE POLICY "ai_change_proposals: select own"
  ON public.ai_change_proposals FOR SELECT
  USING (auth.uid() = user_id);
