-- Compléments au stub pour le brouillon 0003 : ce que la vraie base a et que
-- stub.sql n'a pas besoin de simuler pour 0001. Base de test jetable uniquement.
CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public, auth TO service_role;
ALTER TABLE public.collections ADD CONSTRAINT collections_id_user_id_key UNIQUE (id, user_id);
ALTER TABLE public.collections ADD COLUMN updated_at timestamptz DEFAULT now();
CREATE TABLE public.share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users,
  token text NOT NULL UNIQUE,
  object_ids uuid[] NOT NULL,
  title text,
  options jsonb NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.share_links TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collections: select own" ON public.collections FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "collections: update own" ON public.collections FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- Ana : collection « Grenier » (Perceuse) et « Cuisine » (Casserole, Poêle).
INSERT INTO public.collections (id, user_id, drawer_id, name) VALUES
 ('c0000000-0000-0000-0000-0000000000a2','aaaaaaaa-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000a','Cuisine');
INSERT INTO public.objects (id, user_id, collection_id, title) VALUES
 ('00000000-0000-0000-0000-0000000000a3','aaaaaaaa-0000-0000-0000-000000000000','c0000000-0000-0000-0000-0000000000a2','Casserole'),
 ('00000000-0000-0000-0000-0000000000a4','aaaaaaaa-0000-0000-0000-000000000000','c0000000-0000-0000-0000-0000000000a2','Poêle');
INSERT INTO public.share_links (token, user_id, object_ids) VALUES
 -- tout Cuisine : collection déduite
 ('cuisine','aaaaaaaa-0000-0000-0000-000000000000','{00000000-0000-0000-0000-0000000000a3,00000000-0000-0000-0000-0000000000a4}'),
 -- Cuisine + Grenier : pas de collection unique
 ('melange','aaaaaaaa-0000-0000-0000-000000000000','{00000000-0000-0000-0000-0000000000a3,00000000-0000-0000-0000-0000000000a1}'),
 -- objet hors collection
 ('velo','aaaaaaaa-0000-0000-0000-000000000000','{00000000-0000-0000-0000-0000000000a2}');
INSERT INTO public.share_links (token, user_id, object_ids, is_archived) VALUES
 ('archive','aaaaaaaa-0000-0000-0000-000000000000','{00000000-0000-0000-0000-0000000000a3}', true);
