-- Base de test jetable pour profiles_locale.sql : auth.users avec ses
-- métadonnées, profiles, drawers, activity_log, déclencheur d'inscription.
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, display_name text);
CREATE TABLE public.drawers (user_id uuid UNIQUE, name text);
CREATE TABLE public.activity_log (user_id uuid, action text, payload jsonb);
-- Comptes d'avant le brouillon : l'un avec une langue, l'autre sans.
INSERT INTO auth.users VALUES ('11111111-0000-0000-0000-000000000000', 'a@x.fr', '{"locale":"de"}'),
                              ('22222222-0000-0000-0000-000000000000', 'b@x.fr', '{}');
INSERT INTO public.profiles VALUES ('11111111-0000-0000-0000-000000000000', 'a'), ('22222222-0000-0000-0000-000000000000', 'b');
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
