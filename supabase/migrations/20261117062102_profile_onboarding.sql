-- ================================================================
-- profile_onboarding.sql
-- L'onboarding de l'app (mobile/app/(app)/onboarding.tsx) : trois écrans
-- après la première connexion — l'usage, le métier, une première
-- collection. Ce que le compte y répond est gardé dans son profil.
--
--   usage                    perso | creatif | business ; NULL = pas dit
--   metier                   identifiant d'un métier de la liste de l'app
--                            (mobile/src/features/onboarding/metiers.ts),
--                            ou « autre » ; NULL = pas dit
--   metier_autre             le métier écrit à la main quand « autre »
--   onboarding_completed_at  moment où l'onboarding a été terminé OU
--                            passé ; NULL = jamais présenté. C'est la
--                            seule colonne que l'app lit pour décider de
--                            l'afficher : une date, il ne revient plus.
--
-- metier est un texte borné et non une liste fermée en base, comme
-- profiles.persona (20261113084459) : la liste vit dans l'app et s'allonge
-- sans migration. Quand le métier choisi existe aussi dans la liste du
-- site (web/lib/personas.ts), l'app remplit persona si elle est vide,
-- pour que le site ne repose pas la question.
--
-- Ce sont des déclarations d'usage, rien d'autre : elles ne changent ni
-- le palier ni aucun droit, et ne déclenchent aucun paiement.
--
-- Accès : rien de nouveau côté lignes — « profiles: select own » et
-- « profiles: update own » (20260622214843) bornent déjà chaque compte à
-- son propre profil. Côté colonnes, authenticated n'écrit que la liste
-- posée par 20260926140000 ; ces quatre colonnes la rejoignent.
--
-- Additif et rejouable. Une seule écriture sur l'existant : les comptes
-- déjà là au moment de la migration sont marqués comme ayant vu
-- l'onboarding (usage NULL = ils n'ont rien répondu), pour qu'il ne
-- s'ouvre qu'aux nouveaux comptes. Il reste accessible dans Paramètres.
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS usage                   TEXT        NULL,
  ADD COLUMN IF NOT EXISTS metier                  TEXT        NULL,
  ADD COLUMN IF NOT EXISTS metier_autre            TEXT        NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_usage_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_usage_check
  CHECK (usage IS NULL OR usage IN ('perso', 'creatif', 'business'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_metier_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_metier_format
  CHECK (metier IS NULL OR metier ~ '^[a-z][a-z_]{1,39}$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_metier_autre_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_metier_autre_length
  CHECK (metier_autre IS NULL OR char_length(metier_autre) BETWEEN 1 AND 80);

COMMENT ON COLUMN public.profiles.usage IS
  'Usage declare a l onboarding : perso, creatif ou business. NULL = pas dit. Ne change ni le palier ni aucun droit.';
COMMENT ON COLUMN public.profiles.metier IS
  'Metier choisi a l onboarding (mobile/src/features/onboarding/metiers.ts), ou autre. NULL = pas dit.';
COMMENT ON COLUMN public.profiles.metier_autre IS
  'Metier ecrit a la main quand metier = autre.';
COMMENT ON COLUMN public.profiles.onboarding_completed_at IS
  'Moment ou l onboarding a ete termine ou passe. NULL = jamais presente : l app l affiche a la prochaine ouverture.';

GRANT UPDATE (usage, metier, metier_autre, onboarding_completed_at)
  ON public.profiles TO authenticated;

-- Les comptes déjà là ne sont pas des nouveaux comptes.
UPDATE public.profiles
   SET onboarding_completed_at = now()
 WHERE onboarding_completed_at IS NULL;
