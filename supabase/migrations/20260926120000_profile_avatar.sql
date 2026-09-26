-- ================================================================
-- 20260926120000_profile_avatar.sql
-- Autoriser une photo de profil choisie par l'utilisateur.
--
-- profiles.avatar_url existe depuis le schema initial et n'a jamais ete
-- ecrit. On ne le reutilise pas : le web l'affiche tel quel dans un <img>,
-- il attend donc une URL publique, alors que le bucket object-images est
-- prive. On ajoute avatar_path, le chemin dans le bucket, lu par l'app
-- via une URL signee — comme les couvertures de collection.
--
-- Chemin : {uid}/avatar/{horodatage}.jpg. Pas de ligne a laquelle
-- l'adosser, contrairement aux objets et collections : le prefixe {uid}
-- suffit a garantir que chacun n'ecrit que sa propre photo.
--
-- Les policies INSERT et UPDATE sont reprises telles quelles de
-- 20260807100000_collection_cover_qualify_name.sql, avec une quatrieme
-- branche. La branche objet exclut desormais aussi 'avatar'.
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path TEXT;

COMMENT ON COLUMN public.profiles.avatar_path IS
  'Photo de profil, {uid}/avatar/* dans object-images. Remplace l initiale quand elle existe.';

DROP POLICY IF EXISTS "storage object-images: insert own" ON storage.objects;

CREATE POLICY "storage object-images: insert own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'object-images'
  AND auth.uid()::text = split_part(storage.objects.name, '/', 1)
  AND (
    -- Chemin objet confirme
    (
      split_part(storage.objects.name, '/', 2) NOT IN ('drafts', 'collections', 'avatar')
      AND EXISTS (
        SELECT 1 FROM public.objects o
        WHERE o.id::text = split_part(storage.objects.name, '/', 2)
          AND o.user_id = auth.uid()
      )
    )
    OR
    -- Chemin draft actif
    (
      split_part(storage.objects.name, '/', 2) = 'drafts'
      AND EXISTS (
        SELECT 1 FROM public.ai_drafts d
        WHERE d.id::text = split_part(storage.objects.name, '/', 3)
          AND d.user_id = auth.uid()
          AND d.status IN ('uploading', 'pending')
      )
    )
    OR
    -- Couverture de collection
    (
      split_part(storage.objects.name, '/', 2) = 'collections'
      AND EXISTS (
        SELECT 1 FROM public.collections c
        WHERE c.id::text = split_part(storage.objects.name, '/', 3)
          AND c.user_id = auth.uid()
      )
    )
    OR
    -- Photo de profil
    split_part(storage.objects.name, '/', 2) = 'avatar'
  )
);

DROP POLICY IF EXISTS "storage object-images: update own" ON storage.objects;

CREATE POLICY "storage object-images: update own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'object-images'
  AND auth.uid()::text = split_part(storage.objects.name, '/', 1)
)
WITH CHECK (
  bucket_id = 'object-images'
  AND auth.uid()::text = split_part(storage.objects.name, '/', 1)
  AND (
    (
      split_part(storage.objects.name, '/', 2) NOT IN ('drafts', 'collections', 'avatar')
      AND EXISTS (
        SELECT 1 FROM public.objects o
        WHERE o.id::text = split_part(storage.objects.name, '/', 2)
          AND o.user_id = auth.uid()
      )
    )
    OR
    (
      split_part(storage.objects.name, '/', 2) = 'drafts'
      AND EXISTS (
        SELECT 1 FROM public.ai_drafts d
        WHERE d.id::text = split_part(storage.objects.name, '/', 3)
          AND d.user_id = auth.uid()
          AND d.status IN ('uploading', 'pending')
      )
    )
    OR
    (
      split_part(storage.objects.name, '/', 2) = 'collections'
      AND EXISTS (
        SELECT 1 FROM public.collections c
        WHERE c.id::text = split_part(storage.objects.name, '/', 3)
          AND c.user_id = auth.uid()
      )
    )
    OR
    split_part(storage.objects.name, '/', 2) = 'avatar'
  )
);
