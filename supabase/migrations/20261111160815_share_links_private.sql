-- share_links_private.sql — la table des partages n'est plus lisible par tous.
--
-- Trou ouvert en prod depuis la création de la table (20260625173437) : la
-- règle « public can read by token » vaut USING (true), et anon a le droit
-- SELECT. Avec la clé anonyme (publique : elle est dans l'app et le site),
-- n'importe qui lisait TOUS les partages : les jetons (qui ouvrent les liens
-- sans mot de passe), les empreintes de mot de passe (options.password_hash,
-- SHA-256 sans sel) et les coordonnées de contact (options.contact_*).
-- Relevé du 11/11/2026 : 51 liens, 7 propriétaires, 17 empreintes, 5 contacts.
--
-- Après : seul le propriétaire, connecté, lit et gère ses liens. Le site lit
-- un partage par son jeton avec la clé service (web/pages/s/…,
-- web/pages/api/shares/…), les fonctions create-share-link et delete-account
-- aussi, et les fonctions SQL des suggestions et du compteur de vues sont
-- SECURITY DEFINER : rien de tout cela ne dépend de la règle retirée.
--
-- Ce qui change pour l'app :
--   - mobile/app/s/[token].tsx (ouvert par lien profond seulement) : un
--     visiteur obtient « lien introuvable ». Il n'y voyait déjà aucun objet
--     (objects n'est lisible que par son propriétaire). Le partage public,
--     c'est le site.
--   - mobile/app/(app)/profile.tsx : le compteur de partages comptait ceux de
--     tout le monde ; il ne compte plus que ceux du compte.
--
-- Aucune donnée modifiée. Rejouable. Retour arrière :
-- supabase/drafts/rollback/share_links_private.rollback.sql.
--
-- En prod depuis le 11/11/2026 (éditeur SQL, version inscrite à la main :
-- 20261111160815).

BEGIN;

DROP POLICY IF EXISTS "public can read by token" ON public.share_links;

-- Même règle qu'avant pour le propriétaire, réservée aux comptes connectés,
-- et WITH CHECK explicite : on ne crée ni ne cède un lien au nom d'un autre.
DROP POLICY IF EXISTS "owner can manage" ON public.share_links;
CREATE POLICY "owner can manage"
  ON public.share_links FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Les droits par défaut de Supabase donnaient tout à anon. La règle ci-dessus
-- suffit, mais un droit inutile est une règle oubliée de trop près.
REVOKE ALL ON public.share_links FROM anon, PUBLIC;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.share_links FROM authenticated;

COMMIT;
