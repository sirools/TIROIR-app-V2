-- ================================================================
-- 005_storage_and_policies.sql
-- Bucket object-images · policies SELECT / INSERT / UPDATE / DELETE
-- INSERT et UPDATE bifurqués : chemin objet confirmé OU draft actif.
-- UPDATE WITH CHECK miroir exact de INSERT WITH CHECK.
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'object-images',
  'object-images',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- ── SELECT ────────────────────────────────────────────────────────

CREATE POLICY "storage object-images: select own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'object-images'
  AND auth.uid()::text = split_part(name, '/', 1)
);

-- ── INSERT ────────────────────────────────────────────────────────
-- Chemin objet  : {user_id}/{object_id}/{image_id}.ext
-- Chemin draft  : {user_id}/drafts/{draft_id}/{image_id}.ext
-- Draft accepté en statut 'uploading' ou 'pending' uniquement.

CREATE POLICY "storage object-images: insert own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'object-images'
  AND auth.uid()::text = split_part(name, '/', 1)
  AND (
    -- Chemin objet confirmé
    (
      split_part(name, '/', 2) <> 'drafts'
      AND EXISTS (
        SELECT 1 FROM public.objects
        WHERE id::text = split_part(name, '/', 2)
          AND user_id = auth.uid()
      )
    )
    OR
    -- Chemin draft actif
    (
      split_part(name, '/', 2) = 'drafts'
      AND EXISTS (
        SELECT 1 FROM public.ai_drafts
        WHERE id::text = split_part(name, '/', 3)
          AND user_id = auth.uid()
          AND status IN ('uploading', 'pending')
      )
    )
  )
);

-- ── UPDATE ────────────────────────────────────────────────────────
-- USING : appartenance du fichier existant.
-- WITH CHECK : même validation bifurquée que INSERT.

CREATE POLICY "storage object-images: update own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'object-images'
  AND auth.uid()::text = split_part(name, '/', 1)
)
WITH CHECK (
  bucket_id = 'object-images'
  AND auth.uid()::text = split_part(name, '/', 1)
  AND (
    -- Chemin objet confirmé
    (
      split_part(name, '/', 2) <> 'drafts'
      AND EXISTS (
        SELECT 1 FROM public.objects
        WHERE id::text = split_part(name, '/', 2)
          AND user_id = auth.uid()
      )
    )
    OR
    -- Chemin draft actif
    (
      split_part(name, '/', 2) = 'drafts'
      AND EXISTS (
        SELECT 1 FROM public.ai_drafts
        WHERE id::text = split_part(name, '/', 3)
          AND user_id = auth.uid()
          AND status IN ('uploading', 'pending')
      )
    )
  )
);

-- ── DELETE ────────────────────────────────────────────────────────

CREATE POLICY "storage object-images: delete own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'object-images'
  AND auth.uid()::text = split_part(name, '/', 1)
);
