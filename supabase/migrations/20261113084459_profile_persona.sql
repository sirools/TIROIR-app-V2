-- ================================================================
-- 20261113084459_profile_persona.sql
-- profiles.persona : le profil choisi à l'inscription (particulier,
-- vidéaste, brocanteur…), modifiable ensuite dans « Profil ». Il ne sert
-- qu'à choisir les cartes du tableau de bord du site (web/lib/dashboard.ts).
--
-- Texte libre borné, et non une liste fermée en base : la liste des
-- profils vit dans web/lib/personas.ts et s'allonge sans migration. NULL =
-- pas encore choisi (le tableau de bord montre alors les cartes de base).
--
-- C'est un métier ou un usage déclaré, rien d'autre : aucune donnée liée à
-- des patients n'a sa place ici ni ailleurs dans cette base (les profils
-- de santé renvoient vers un contact pour l'offre Business).
--
-- Comme display_name et avatar_path, le compte écrit lui-même sa valeur :
-- la colonne rejoint la liste des colonnes modifiables posée par
-- 20260926140000_profiles_update_columns.sql.
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS persona TEXT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_persona_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_persona_format
  CHECK (persona IS NULL OR persona ~ '^[a-z][a-z_]{1,39}$');

COMMENT ON COLUMN public.profiles.persona IS
  'Profil choisi a l inscription (web/lib/personas.ts). Sert a choisir les cartes du tableau de bord. NULL = pas encore choisi.';

GRANT UPDATE (persona) ON public.profiles TO authenticated;
