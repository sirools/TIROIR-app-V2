-- ================================================================
-- 20260807090000_collection_cover_storage.sql
-- Autoriser une photo de couverture sur une collection.
--
-- La colonne collections.cover_image_path existe depuis le schema initial
-- et n'a jamais servi : rien ne pouvait ecrire le fichier. La policy
-- INSERT du bucket object-images n'accepte un chemin que s'il est adosse a
-- une ligne appartenant a l'utilisateur — {uid}/{object_id}/ ou
-- {uid}/drafts/{draft_id}/ — et une collection n'entrait dans aucun des
-- deux cas.
--
-- On ajoute donc une troisieme branche, sur le meme principe que les
-- drafts : {uid}/collections/{collection_id}/... valide si la collection
-- existe et appartient a l'appelant. Aucune branche existante n'est
-- modifiee.
--
-- Une emoji sur fond colore reste le defaut. La photo la remplace quand
-- elle existe : c'est l'un OU l'autre, jamais les deux superposes — un
-- badge pose sur une photo de dressing n'aide personne a reconnaitre son
-- dressing.
-- ================================================================

DROP POLICY IF EXISTS "storage object-images: insert own" ON storage.objects;

CREATE POLICY "storage object-images: insert own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'object-images'
  AND auth.uid()::text = split_part(name, '/', 1)
  AND (
    -- Chemin objet confirme
    (
      split_part(name, '/', 2) NOT IN ('drafts', 'collections')
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
    OR
    -- Couverture de collection
    (
      split_part(name, '/', 2) = 'collections'
      AND EXISTS (
        SELECT 1 FROM public.collections
        WHERE id::text = split_part(name, '/', 3)
          AND user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "storage object-images: update own" ON storage.objects;

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
    (
      split_part(name, '/', 2) NOT IN ('drafts', 'collections')
      AND EXISTS (
        SELECT 1 FROM public.objects
        WHERE id::text = split_part(name, '/', 2)
          AND user_id = auth.uid()
      )
    )
    OR
    (
      split_part(name, '/', 2) = 'drafts'
      AND EXISTS (
        SELECT 1 FROM public.ai_drafts
        WHERE id::text = split_part(name, '/', 3)
          AND user_id = auth.uid()
          AND status IN ('uploading', 'pending')
      )
    )
    OR
    (
      split_part(name, '/', 2) = 'collections'
      AND EXISTS (
        SELECT 1 FROM public.collections
        WHERE id::text = split_part(name, '/', 3)
          AND user_id = auth.uid()
      )
    )
  )
);

COMMENT ON COLUMN public.collections.cover_image_path IS
  'Photo de couverture, {uid}/collections/{id}/*. Remplace l emoji quand elle existe.';
