-- ================================================================
-- 20260625173437_create_share_links.sql
-- Liens de partage publics (sélections d'objets consultables sans compte)
-- ================================================================

CREATE TABLE public.share_links (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  object_ids UUID[]      NOT NULL,
  title      TEXT        NULL,
  options    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NULL,
  view_count INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can manage"
  ON public.share_links FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "public can read by token"
  ON public.share_links FOR SELECT
  USING (true);
