-- Complément de supabase/drafts/tests/stub_essai.sql pour le banc e2e de
-- l'essai sans compte : les colonnes que lisent les pages du site
-- (fiche objet, en-tête), et les règles d'accès de profiles comme en prod.
ALTER TABLE public.profiles
  ADD COLUMN display_name text, ADD COLUMN avatar_url text, ADD COLUMN avatar_path text,
  ADD COLUMN is_admin boolean NOT NULL DEFAULT false, ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles: select own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

ALTER TABLE public.objects
  ADD COLUMN group_id uuid, ADD COLUMN quantity integer NOT NULL DEFAULT 1, ADD COLUMN user_value numeric,
  ADD COLUMN description text, ADD COLUMN sale_price numeric, ADD COLUMN sale_price_lot numeric,
  ADD COLUMN listing_platform text, ADD COLUMN listed_at timestamptz, ADD COLUMN sold_at timestamptz, ADD COLUMN sold_price numeric,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.object_images ADD COLUMN zoom_path text;
CREATE TABLE public.collections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL);
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
