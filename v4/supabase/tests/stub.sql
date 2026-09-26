-- Tables minimales de Tiroir V2 (colonnes utiles aux brouillons V4.0), rôles
-- et privilèges par défaut comme sur Supabase. Base de test jetable uniquement.
CREATE ROLE anon; CREATE ROLE authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users, display_name text);
CREATE TABLE public.drawers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES auth.users, name text NOT NULL DEFAULT 'Mon Tiroir', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.drawers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drawers: select own" ON public.drawers FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE TABLE public.collections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, drawer_id uuid REFERENCES public.drawers, name text, emoji text DEFAULT '📦', icon_color text DEFAULT '#E8F0E0', pinned_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, collection_id uuid, title text, description text, status text DEFAULT 'owned', location_note text, quantity int DEFAULT 1, updated_at timestamptz DEFAULT now());
CREATE TABLE public.object_images (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid, storage_path text, is_cover bool DEFAULT false, position int DEFAULT 0);
ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "objects: select own" ON public.objects FOR SELECT USING ((SELECT auth.uid()) = user_id);
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
-- Ana (a), Bob (b), Chloé (c) ; le Tiroir d'Ana existe AVANT la migration (backfill)
INSERT INTO auth.users VALUES ('aaaaaaaa-0000-0000-0000-000000000000'),('bbbbbbbb-0000-0000-0000-000000000000'),('cccccccc-0000-0000-0000-000000000000');
INSERT INTO public.profiles VALUES ('aaaaaaaa-0000-0000-0000-000000000000','Ana'),('bbbbbbbb-0000-0000-0000-000000000000','Bob'),('cccccccc-0000-0000-0000-000000000000','Chloé');
INSERT INTO public.drawers (id, user_id) VALUES ('d0000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000000');
INSERT INTO public.collections (id, user_id, drawer_id, name) VALUES ('c0000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000a','Grenier');
INSERT INTO public.objects (id, user_id, collection_id, title) VALUES
 ('00000000-0000-0000-0000-0000000000a1','aaaaaaaa-0000-0000-0000-000000000000','c0000000-0000-0000-0000-00000000000a','Perceuse'),
 ('00000000-0000-0000-0000-0000000000a2','aaaaaaaa-0000-0000-0000-000000000000',NULL,'Vélo');
INSERT INTO public.object_images (object_id, storage_path, is_cover, position) VALUES
 ('00000000-0000-0000-0000-0000000000a1','a/1/2.jpg',false,1),('00000000-0000-0000-0000-0000000000a1','a/1/cover.jpg',true,2);
