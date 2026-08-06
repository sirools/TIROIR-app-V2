-- ================================================================
-- 20260806220538_share_view_count_increment.sql
-- increment_share_view() : compteur de vues des liens partagés.
--
-- `share_links.view_count` existait depuis la création de la table
-- (20260625173437) et était affiché dans l'app, mais RIEN ne l'incrémentait :
-- tous les partages annonçaient « 0 vue » à leur propriétaire, sur la seule
-- surface publique du produit.
--
-- SECURITY DEFINER : la politique d'écriture de share_links est réservée au
-- propriétaire, or un visiteur n'est pas le propriétaire — par définition.
-- La fonction ne fait qu'incrémenter un compteur, elle n'expose rien.
--
-- L'incrément est une expression SQL et non un lire-puis-écrire : deux
-- visites simultanées ne peuvent pas s'annuler.
--
-- Les liens archivés ou expirés ne comptent pas : leur page ne s'affiche
-- pas, une vue n'aurait rien désigné.
-- ================================================================

CREATE OR REPLACE FUNCTION public.increment_share_view(p_token TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.share_links
     SET view_count = view_count + 1
   WHERE token = p_token
     AND is_archived = false
     AND (expires_at IS NULL OR expires_at > now());
$$;

REVOKE EXECUTE ON FUNCTION public.increment_share_view(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_share_view(TEXT) TO anon, authenticated, service_role;
