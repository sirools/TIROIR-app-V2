-- Langue des comptes : profiles.locale.
--
-- La langue est choisie côté client et gardée dans user_metadata.locale
-- (site : langue de la page d'inscription, qui suit le point d'entrée ;
-- app : langue de l'app, mise à jour quand on la change dans les réglages).
-- Ce brouillon la recopie dans profiles, là où le SQL des e-mails
-- (présentation J+3, etc.) choisit ses destinataires.
--
-- Additif, rejouable sans effet. NULL = langue inconnue : les e-mails
-- partent alors en français, comme aujourd'hui.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale text
  CHECK (locale IN ('fr', 'en', 'da', 'de', 'es', 'pt-BR', 'pt-PT'));

COMMENT ON COLUMN public.profiles.locale IS
  'Langue du compte, recopiée de auth.users.raw_user_meta_data->>''locale''. NULL = inconnue (e-mails en français).';

-- « de-DE » → « de » ; le portugais garde sa variante (« pt-PT », « pt_PT »
-- → « pt-PT » ; « pt-BR », « pt » → « pt-BR », comme l'app) ; tout le
-- reste → NULL. Liste des langues : design/i18n/languages.json.
CREATE OR REPLACE FUNCTION public.account_locale(meta jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN l IN ('fr', 'en', 'da', 'de', 'es') THEN l
    WHEN l = 'pt' THEN CASE WHEN r IN ('pt', 'ao', 'mz', 'cv', 'gw', 'st', 'tl', 'mo') THEN 'pt-PT' ELSE 'pt-BR' END
  END
  FROM (
    SELECT lower(left(v, 2)) AS l, lower(substr(v, 4, 2)) AS r
    FROM (SELECT replace(btrim(meta->>'locale'), '_', '-') AS v) a
  ) s
$$;

-- Inscription : même corps que 20260630000000_analytics_events.sql, plus la langue.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, locale)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    public.account_locale(NEW.raw_user_meta_data)
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.drawers (user_id, name)
  VALUES (NEW.id, 'Mon Tiroir')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.activity_log (user_id, action, payload)
  VALUES (NEW.id, 'account.created', '{}'::jsonb);

  RETURN NEW;
END;
$$;

-- Changement de langue (Google/Apple rattachés après coup, réglages de
-- l'app) : recopié à chaque mise à jour des métadonnées. Une langue
-- illisible ne vide jamais une langue connue.
CREATE OR REPLACE FUNCTION public.sync_profile_locale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  l text := public.account_locale(NEW.raw_user_meta_data);
BEGIN
  IF l IS NOT NULL THEN
    UPDATE public.profiles SET locale = l
    WHERE id = NEW.id AND locale IS DISTINCT FROM l;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_locale() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_locale_changed ON auth.users;
CREATE TRIGGER on_auth_user_locale_changed
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_user_meta_data->>'locale' IS DISTINCT FROM NEW.raw_user_meta_data->>'locale')
  EXECUTE FUNCTION public.sync_profile_locale();

-- Comptes existants qui ont déjà une langue dans leurs métadonnées.
UPDATE public.profiles p
SET locale = public.account_locale(u.raw_user_meta_data)
FROM auth.users u
WHERE u.id = p.id
  AND p.locale IS NULL
  AND public.account_locale(u.raw_user_meta_data) IS NOT NULL;
