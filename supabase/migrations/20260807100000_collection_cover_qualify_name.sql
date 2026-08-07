-- ================================================================
-- 20260807100000_collection_cover_qualify_name.sql
-- Correctif : la couverture de collection etait refusee par la policy.
--
-- Dans la branche ajoutee par 20260807090000, la sous-requete s'ecrivait
--
--   EXISTS (SELECT 1 FROM public.collections
--            WHERE id::text = split_part(name, '/', 3) ...)
--
-- et ce `name` non qualifie se resolvait en collections.name — le NOM DE
-- LA COLLECTION — au lieu de storage.objects.name. La condition comparait
-- donc un identifiant a un fragment de « Brocante », et refusait tout.
--
-- La branche des drafts avait la meme ecriture et fonctionnait par
-- chance : ai_drafts n'a pas de colonne `name`, le nom se resolvait donc
-- bien sur storage.objects. Compter la-dessus n'est pas une garantie.
--
-- Toutes les references sont qualifiees, y compris celles qui marchaient,
-- et les tables de la sous-requete recoivent un alias.
-- ================================================================

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
      split_part(storage.objects.name, '/', 2) NOT IN ('drafts', 'collections')
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
      split_part(storage.objects.name, '/', 2) NOT IN ('drafts', 'collections')
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
  )
);
