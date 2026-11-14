-- Base de test jetable pour essai_sans_compte.sql : rôles, auth.users,
-- et le strict nécessaire de profiles, app_settings, objects, object_images.
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA auth, public TO authenticated, anon, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free', pro_expires_at date, persona text
);
CREATE TABLE public.app_settings (id smallint PRIMARY KEY DEFAULT 1, free_objects_max integer NOT NULL DEFAULT 30);
INSERT INTO public.app_settings (id) VALUES (1);
CREATE TABLE public.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid, title text NOT NULL, status text NOT NULL DEFAULT 'owned', location_note text,
  attributes jsonb NOT NULL DEFAULT '{}', market_value numeric, value_currency text NOT NULL DEFAULT '€',
  value_sources jsonb, value_estimated_at timestamptz, UNIQUE (id, user_id)
);
CREATE TABLE public.object_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid NOT NULL, user_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE, mime_type text NOT NULL, size_bytes integer, position integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  FOREIGN KEY (object_id, user_id) REFERENCES public.objects(id, user_id) ON DELETE CASCADE
);
CREATE FUNCTION public.effective_plan(p_plan text, p_pro_expires_at date) RETURNS text LANGUAGE sql STABLE AS
$$ SELECT CASE WHEN p_plan = 'pro' AND p_pro_expires_at < CURRENT_DATE THEN 'free' ELSE p_plan END $$;
CREATE FUNCTION public.is_paid_plan(p_plan text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT p_plan IN ('premium', 'pro') $$;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
-- Comme en prod (20260926140000_profiles_update_columns.sql) : le compte ne modifie que des colonnes nommées.
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (persona) ON public.profiles TO authenticated;

-- Comptes d'avant le brouillon : métiers déjà déclarés (rattrapage).
INSERT INTO auth.users VALUES
  ('aaaaaaaa-0000-0000-0000-000000000000'), ('bbbbbbbb-0000-0000-0000-000000000000'),
  ('cccccccc-0000-0000-0000-000000000000'), ('dddddddd-0000-0000-0000-000000000000'),
  ('eeeeeeee-0000-0000-0000-000000000000');
INSERT INTO public.profiles (id, persona) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000000', 'collectionneur'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'videaste'),
  ('cccccccc-0000-0000-0000-000000000000', 'brocanteur'),
  ('dddddddd-0000-0000-0000-000000000000', 'autre'),
  ('eeeeeeee-0000-0000-0000-000000000000', NULL);
