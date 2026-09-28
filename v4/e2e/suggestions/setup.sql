-- Banc e2e des suggestions : complète stub.sql + stub_0003.sql pour que la
-- page /s/[token] tourne contre PostgREST. Base jetable uniquement.

-- auth.uid() comme sur Supabase : PostgREST 12 passe les claims en JSON.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;

-- Colonnes lues par la page et l'en-tête, absentes du stub.
ALTER TABLE public.objects
  ADD COLUMN created_at timestamptz DEFAULT now(),
  ADD COLUMN attributes jsonb DEFAULT '{}',
  ADD COLUMN market_value numeric, ADD COLUMN user_value numeric, ADD COLUMN value_currency text,
  ADD COLUMN purchase_price numeric, ADD COLUMN purchase_currency text, ADD COLUMN purchase_date date,
  ADD COLUMN sale_price numeric, ADD COLUMN sale_price_lot numeric, ADD COLUMN deposit_amount numeric,
  ADD COLUMN insured boolean DEFAULT false;
CREATE TABLE public.object_insurances (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid);
ALTER TABLE public.profiles ADD COLUMN avatar_path text, ADD COLUMN is_admin boolean DEFAULT false;
ALTER TABLE public.share_links ADD COLUMN view_count int NOT NULL DEFAULT 0;
CREATE FUNCTION public.increment_share_view(p_token text) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.share_links SET view_count = view_count + 1 WHERE token = p_token $$;

-- Données : Ana partage « Ma cuisine », en clair et protégée (mot de passe : tiroir).
UPDATE public.share_links SET title = 'Ma cuisine' WHERE token = 'cuisine';
INSERT INTO public.share_links (token, user_id, object_ids, title, options) VALUES
 ('secret','aaaaaaaa-0000-0000-0000-000000000000','{00000000-0000-0000-0000-0000000000a3,00000000-0000-0000-0000-0000000000a4}','Cuisine (protégée)',
  jsonb_build_object('password_protected', true, 'password_hash', encode(sha256('tiroir'::bytea),'hex')));
UPDATE public.profiles SET display_name = 'Ana Martin' WHERE display_name = 'Ana';
UPDATE public.profiles SET display_name = 'Bob Durand' WHERE display_name = 'Bob';

-- Rôles PostgREST.
DO $$ BEGIN CREATE ROLE authenticator LOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT anon, authenticated, service_role TO authenticator;
ALTER ROLE service_role BYPASSRLS;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Bob a son propre Tiroir : un wok, avec une photo.
INSERT INTO public.objects (id, user_id, title) VALUES
 ('b0000000-0000-0000-0000-0000000000b1','bbbbbbbb-0000-0000-0000-000000000000','Wok de Bob');
INSERT INTO public.object_images (object_id, storage_path, is_cover) VALUES
 ('b0000000-0000-0000-0000-0000000000b1','bbbbbbbb-0000-0000-0000-000000000000/b1/wok.jpg', true);
