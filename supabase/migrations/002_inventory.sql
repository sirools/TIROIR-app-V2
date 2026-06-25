-- ================================================================
-- 002_inventory.sql
-- is_flat_json_object · collections · objects · object_images
-- FK composites · CHECK JSONB plat · contraintes d'images
-- ================================================================

-- ── Validation JSONB plat ─────────────────────────────────────────
-- Garantit que attributes est un objet JSON sans valeurs imbriquées
-- (pas d'objet ni de tableau comme valeur directe).
-- Clés recommandées : brand, model, category, serial_number,
--   estimated_value, currency, color, material, dimensions, voltage.

CREATE OR REPLACE FUNCTION public.is_flat_json_object(val JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT
    jsonb_typeof(val) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each(val) AS kv(k, v)
      WHERE jsonb_typeof(kv.v) IN ('object', 'array')
    )
$$;

-- ── Trigger search_vector ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_object_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.location_note, '') || ' ' ||
    coalesce((
      SELECT string_agg(v, ' ')
      FROM jsonb_each_text(NEW.attributes) AS t(k, v)
    ), '')
  );
  RETURN NEW;
END;
$$;

-- ── collections ───────────────────────────────────────────────────

CREATE TABLE public.collections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drawer_id        UUID        NOT NULL,
  name             TEXT        NOT NULL,
  description      TEXT,
  location         TEXT,
  cover_image_path TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT collections_id_user_id_key UNIQUE (id, user_id)
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- FK composite : garantit que drawer_id appartient au même user
ALTER TABLE public.collections
  ADD CONSTRAINT collections_drawer_user_fk
    FOREIGN KEY (drawer_id, user_id)
    REFERENCES public.drawers(id, user_id);

CREATE TRIGGER set_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX collections_user_id_idx   ON public.collections (user_id);
CREATE INDEX collections_drawer_id_idx ON public.collections (drawer_id);

CREATE POLICY "collections: select own"
  ON public.collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "collections: insert own"
  ON public.collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections: update own"
  ON public.collections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections: delete own"
  ON public.collections FOR DELETE
  USING (auth.uid() = user_id);

-- ── objects ───────────────────────────────────────────────────────
-- Écriture réservée aux RPC confirm_draft, confirm_change_proposal,
-- delete_object. Aucune policy INSERT/UPDATE/DELETE client.

CREATE TABLE public.objects (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id UUID,
  title         TEXT        NOT NULL,
  description   TEXT,
  status        TEXT        NOT NULL DEFAULT 'owned'
                              CHECK (status IN ('owned','stored','loaned','sold','given','lost')),
  location_note TEXT,
  -- Objet JSON plat : valeurs scalaires uniquement (string, number, bool, null).
  -- Clés recommandées : brand, model, category, serial_number, estimated_value,
  --   currency, color, material, dimensions, voltage.
  attributes    JSONB       NOT NULL DEFAULT '{}'
                              CHECK (public.is_flat_json_object(attributes)),
  search_vector TSVECTOR,
  embedding     extensions.vector(1536),
  embedding_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT objects_id_user_id_key UNIQUE (id, user_id)
);

ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;

-- FK composite : garantit que collection_id appartient au même user
ALTER TABLE public.objects
  ADD CONSTRAINT objects_collection_user_fk
    FOREIGN KEY (collection_id, user_id)
    REFERENCES public.collections(id, user_id);

CREATE TRIGGER set_objects_updated_at
  BEFORE UPDATE ON public.objects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_objects_search_vector
  BEFORE INSERT OR UPDATE OF title, description, location_note, attributes
  ON public.objects
  FOR EACH ROW EXECUTE FUNCTION public.update_object_search_vector();

CREATE INDEX objects_user_id_idx       ON public.objects (user_id);
CREATE INDEX objects_collection_id_idx ON public.objects (collection_id);

-- SELECT uniquement pour les clients
CREATE POLICY "objects: select own"
  ON public.objects FOR SELECT
  USING (auth.uid() = user_id);

-- ── object_images ─────────────────────────────────────────────────

CREATE TABLE public.object_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id    UUID        NOT NULL,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  mime_type    TEXT        NOT NULL
                             CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/heic')),
  size_bytes   INTEGER     CHECK (size_bytes IS NULL OR size_bytes > 0),
  position     INTEGER     NOT NULL DEFAULT 0
                             CHECK (position >= 0),
  is_cover     BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT object_images_storage_path_key UNIQUE (storage_path)
);

-- Index partiel : une seule image de couverture par objet
-- (contrainte intentionnellement hors du CREATE TABLE)
CREATE UNIQUE INDEX object_images_one_cover_idx
  ON public.object_images (object_id)
  WHERE is_cover = true;

-- FK composite : garantit que object_id appartient au même user
ALTER TABLE public.object_images
  ADD CONSTRAINT object_images_object_user_fk
    FOREIGN KEY (object_id, user_id)
    REFERENCES public.objects(id, user_id)
    ON DELETE CASCADE;

ALTER TABLE public.object_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX object_images_object_id_idx ON public.object_images (object_id);
CREATE INDEX object_images_user_id_idx   ON public.object_images (user_id);

CREATE POLICY "object_images: select own"
  ON public.object_images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "object_images: insert own"
  ON public.object_images FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.objects
      WHERE id = object_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "object_images: update own"
  ON public.object_images FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.objects
      WHERE id = object_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "object_images: delete own"
  ON public.object_images FOR DELETE
  USING (auth.uid() = user_id);
