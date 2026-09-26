-- ================================================================
-- 20260926140000_profiles_update_columns.sql
-- Un utilisateur ne peut plus modifier que son nom et sa photo.
--
-- La policy "profiles: update own" borne les LIGNES (la sienne) mais pas
-- les COLONNES, et le rôle authenticated garde le privilège UPDATE sur
-- toute la table. Depuis l'app ou la console du navigateur, n'importe
-- quel compte pouvait donc écrire, sur son propre profil :
--
--   plan = 'pro', is_admin = true, pro_expires_at, ai_analyses_used = 0,
--   les dérogations de quota…
--
-- soit s'offrir le forfait payant, l'accès admin, ou des quotas remis à
-- zéro à volonté.
--
-- Les écritures légitimes de ces colonnes passent toutes par la clé
-- service (webhook RevenueCat, routes admin du web, désinscription) ou
-- par des fonctions SECURITY DEFINER (quotas) : aucune ne dépend du
-- privilège d'authenticated. Côté client, seuls display_name,
-- avatar_path et updated_at sont écrits (mobile : profile.tsx ;
-- web : pages/profil.tsx).
-- ================================================================

REVOKE UPDATE ON public.profiles FROM anon, authenticated;

GRANT UPDATE (display_name, avatar_path, updated_at)
  ON public.profiles TO authenticated;
