-- Retour arrière de share_links_private.sql : remet les règles et les droits
-- relevés en prod le 11/11/2026 juste avant le script :
--   « owner can manage »         ALL    {public}  USING (user_id = auth.uid())
--   « public can read by token » SELECT {public}  USING (true)
--   anon, authenticated : tous les droits sur la table.
-- ROUVRE LE TROU (tous les partages lisibles avec la clé anonyme) : à
-- n'exécuter que si un lecteur oublié casse, le temps de le corriger.
BEGIN;
DROP POLICY IF EXISTS "owner can manage" ON public.share_links;
CREATE POLICY "owner can manage"
  ON public.share_links FOR ALL
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "public can read by token" ON public.share_links;
CREATE POLICY "public can read by token"
  ON public.share_links FOR SELECT
  USING (true);
GRANT ALL ON public.share_links TO anon, authenticated;
COMMIT;
