-- Préparation des tests 0004, après ceux de 0003 (qui suppriment Cuisine).
-- Base de test jetable uniquement.
INSERT INTO public.collections (id, user_id, drawer_id, name, suggestions_enabled) VALUES
 ('c0000000-0000-0000-0000-0000000000a2','aaaaaaaa-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000a','Cuisine', true)
 ON CONFLICT (id) DO UPDATE SET suggestions_enabled = true;
UPDATE public.objects SET collection_id = 'c0000000-0000-0000-0000-0000000000a2'
 WHERE id IN ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4');
DELETE FROM public.collection_wishes;
-- Bob a son propre Tiroir, avec un wok.
INSERT INTO public.objects (id, user_id, title) VALUES
 ('b0000000-0000-0000-0000-0000000000b1','bbbbbbbb-0000-0000-0000-000000000000','Wok de Bob')
 ON CONFLICT (id) DO NOTHING;
