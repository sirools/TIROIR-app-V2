-- Tests du brouillon 0003 : suggestions sur une collection partagée.
-- Ana possède les collections, Bob et Chloé suggèrent.
-- Lancé par run.sh ; affiche un tableau OK / ÉCHEC.
\set ON_ERROR_STOP 1
\o /dev/null
CREATE TEMP TABLE r (n serial, test text, ok bool, detail text);
GRANT ALL ON r TO authenticated, anon, service_role; GRANT USAGE ON SEQUENCE r_n_seq TO authenticated, anon, service_role;
CREATE FUNCTION pg_temp.check(t text, cond bool, d text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$ INSERT INTO r(test, ok, detail) VALUES (t, coalesce(cond,false), d) $$;
CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', u, false) $$;
CREATE FUNCTION pg_temp.fails(q text, expected text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE q; RETURN 'pas d''erreur';
EXCEPTION WHEN others THEN RETURN CASE WHEN SQLERRM = expected THEN 'ok' ELSE SQLERRM END; END $$;

\set A 'aaaaaaaa-0000-0000-0000-000000000000'
\set B 'bbbbbbbb-0000-0000-0000-000000000000'
\set C 'cccccccc-0000-0000-0000-000000000000'
\set CUISINE 'c0000000-0000-0000-0000-0000000000a2'

-- Migration non destructive
SELECT pg_temp.check('les objets existants restent intacts', (SELECT count(*) FROM public.objects) = 4);
SELECT pg_temp.check('suggestions désactivées par défaut', NOT EXISTS (SELECT 1 FROM public.collections WHERE suggestions_enabled));
SELECT pg_temp.check('liens existants sans collection déclarée', NOT EXISTS (SELECT 1 FROM public.share_links WHERE collection_id IS NOT NULL));

-- Collection d'un lien
SET ROLE service_role;
SELECT pg_temp.check('collection déduite quand tous les objets en viennent',
  public.share_link_collection_id((SELECT id FROM public.share_links WHERE token = 'cuisine')) = :'CUISINE');
SELECT pg_temp.check('pas de collection pour un lien mélangé',
  public.share_link_collection_id((SELECT id FROM public.share_links WHERE token = 'melange')) IS NULL);
SELECT pg_temp.check('pas de collection pour un objet hors collection',
  public.share_link_collection_id((SELECT id FROM public.share_links WHERE token = 'velo')) IS NULL);
RESET ROLE;
UPDATE public.share_links SET collection_id = :'CUISINE' WHERE token = 'melange';
SET ROLE service_role;
SELECT pg_temp.check('la collection déclarée prime',
  public.share_link_collection_id((SELECT id FROM public.share_links WHERE token = 'melange')) = :'CUISINE');
RESET ROLE;
UPDATE public.share_links SET collection_id = NULL WHERE token = 'melange';

-- Désactivé : rien ne passe
SET ROLE service_role;
SELECT pg_temp.check('désactivé : suggestion refusée',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'cuisine', :'B', 'Couteau'), 'SUGGESTIONS_DISABLED') = 'ok');
RESET ROLE;

-- Bob ne peut pas activer chez Ana ; Ana active
SET ROLE authenticated;
SELECT pg_temp.as_user(:'B');
SELECT pg_temp.check('Bob ne peut pas activer la collection d''Ana',
  pg_temp.fails(format('SELECT public.set_collection_suggestions(%L, true)', :'CUISINE'), 'NOT_FOUND') = 'ok');
SELECT pg_temp.as_user(:'A');
SELECT public.set_collection_suggestions(:'CUISINE', true);
RESET ROLE;
SELECT pg_temp.check('Ana a activé Cuisine', (SELECT suggestions_enabled FROM public.collections WHERE id = :'CUISINE'));

-- Création des suggestions (serveur web, clé service)
SET ROLE service_role;
SELECT (public.create_collection_suggestion('cuisine', :'B', '  Couteau de chef  ', 'https://exemple.fr/couteau', 89.9)).id AS w1 \gset
SELECT (public.create_collection_suggestion('cuisine', :'C', 'Planche à découper')).id AS w2 \gset
SELECT (public.create_collection_suggestion('cuisine', :'B', 'Mandoline', '', NULL)).id AS w3 \gset
SELECT pg_temp.check('suggestion créée en attente, titre nettoyé',
  EXISTS (SELECT 1 FROM public.collection_wishes WHERE id = :'w1' AND status = 'suggested' AND title = 'Couteau de chef' AND price = 89.90 AND suggested_by = :'B' AND owner_id = :'A' AND collection_id = :'CUISINE'));
SELECT pg_temp.check('lien vide enregistré comme absent', (SELECT url FROM public.collection_wishes WHERE id = :'w3') IS NULL);
SELECT pg_temp.check('auteur obligatoire',
  pg_temp.fails('SELECT public.create_collection_suggestion(''cuisine'', NULL, ''X'')', 'AUTH_REQUIRED') = 'ok');
SELECT pg_temp.check('le propriétaire ne se suggère rien',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'cuisine', :'A', 'X'), 'OWNER_CANNOT_SUGGEST') = 'ok');
SELECT pg_temp.check('lien archivé refusé',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'archive', :'B', 'X'), 'LINK_UNAVAILABLE') = 'ok');
SELECT pg_temp.check('jeton inconnu refusé',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'nope', :'B', 'X'), 'LINK_UNAVAILABLE') = 'ok');
SELECT pg_temp.check('lien sans collection unique refusé',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'melange', :'B', 'X'), 'SUGGESTIONS_DISABLED') = 'ok');
SELECT pg_temp.check('titre vide refusé',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'cuisine', :'B', '   '), 'new row for relation "collection_wishes" violates check constraint "collection_wishes_title_check"') = 'ok');
SELECT pg_temp.check('lien non http refusé',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L, %L)', 'cuisine', :'B', 'X', 'javascript:alert(1)'), 'new row for relation "collection_wishes" violates check constraint "collection_wishes_url_check"') = 'ok');
SELECT pg_temp.check('prix négatif refusé',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L, NULL, -1)', 'cuisine', :'B', 'X'), 'new row for relation "collection_wishes" violates check constraint "collection_wishes_price_check"') = 'ok');
RESET ROLE;

-- Un compte connecté ne peut pas créer directement (contournerait le mot de passe)
SET ROLE authenticated;
SELECT pg_temp.as_user(:'B');
SELECT pg_temp.check('authenticated : création directe refusée',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'cuisine', :'B', 'X'), 'permission denied for function create_collection_suggestion') = 'ok');
SELECT pg_temp.check('authenticated : insertion directe refusée',
  pg_temp.fails(format('INSERT INTO public.collection_wishes (collection_id, owner_id, title) VALUES (%L, %L, %L)', :'CUISINE', :'A', 'X'), 'permission denied for table collection_wishes') = 'ok');
SELECT pg_temp.check('Bob ne lit pas les suggestions d''Ana', (SELECT count(*) FROM public.collection_wishes) = 0);
SELECT pg_temp.check('Bob ne peut pas trier chez Ana',
  pg_temp.fails(format('SELECT public.triage_collection_wish(%L, %L)', :'w1', 'keep'), 'NOT_FOUND') = 'ok');

-- Ana trie
SELECT pg_temp.as_user(:'A');
SELECT pg_temp.check('Ana voit ses 3 suggestions', (SELECT count(*) FROM public.collection_wishes WHERE status = 'suggested') = 3);
SELECT public.triage_collection_wish(:'w1', 'keep');
SELECT public.triage_collection_wish(:'w2', 'dismiss');
SELECT pg_temp.check('garder → idée', (SELECT status FROM public.collection_wishes WHERE id = :'w1') = 'idea');
SELECT pg_temp.check('écarter → écartée', (SELECT status FROM public.collection_wishes WHERE id = :'w2') = 'dismissed');
SELECT pg_temp.check('une suggestion ne se trie qu''une fois',
  pg_temp.fails(format('SELECT public.triage_collection_wish(%L, %L)', :'w1', 'dismiss'), 'NOT_FOUND') = 'ok');
SELECT pg_temp.check('décision inconnue refusée',
  pg_temp.fails(format('SELECT public.triage_collection_wish(%L, %L)', :'w3', 'maybe'), 'INVALID_DECISION') = 'ok');
SELECT public.undo_collection_wish_triage(:'w2');
SELECT pg_temp.check('annulation : de nouveau en attente',
  (SELECT status = 'suggested' AND decided_at IS NULL FROM public.collection_wishes WHERE id = :'w2'));
SELECT pg_temp.check('rien à annuler sur une suggestion en attente',
  pg_temp.fails(format('SELECT public.undo_collection_wish_triage(%L)', :'w3'), 'NOT_FOUND') = 'ok');
SELECT pg_temp.as_user(:'B');
SELECT pg_temp.check('Bob ne peut pas annuler chez Ana',
  pg_temp.fails(format('SELECT public.undo_collection_wish_triage(%L)', :'w1'), 'NOT_FOUND') = 'ok');
SELECT pg_temp.check('authenticated : pas d''accès à share_link_collection_id',
  pg_temp.fails('SELECT public.share_link_collection_id(gen_random_uuid())', 'permission denied for function share_link_collection_id') = 'ok');
RESET ROLE;

-- Désactiver de nouveau : les idées restent, plus de nouvelles suggestions
SET ROLE authenticated;
SELECT pg_temp.as_user(:'A');
SELECT public.set_collection_suggestions(:'CUISINE', false);
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.check('désactivé à nouveau : refusé',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'cuisine', :'B', 'X'), 'SUGGESTIONS_DISABLED') = 'ok');
RESET ROLE;
SELECT pg_temp.check('les idées sont conservées', (SELECT count(*) FROM public.collection_wishes WHERE status = 'idea') = 1);
SELECT pg_temp.check('les objets possédés sont inchangés', (SELECT count(*) FROM public.objects) = 4);

-- Quota de suggestions en attente
UPDATE public.collections SET suggestions_enabled = true WHERE id = :'CUISINE';
INSERT INTO public.collection_wishes (collection_id, owner_id, title, suggested_by)
  SELECT :'CUISINE', :'A', 'x' || g, :'C' FROM generate_series(1, 49) g;
SET ROLE service_role;
SELECT pg_temp.check('50 en attente : la 51e est refusée',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'cuisine', :'C', 'X'), 'TOO_MANY_PENDING') = 'ok');
RESET ROLE;

-- Offres : structure prête
INSERT INTO public.wish_offers (wish_id, owner_id, url, price, merchant, availability)
  VALUES (:'w1', :'A', 'https://exemple.fr/couteau', 79, 'Exemple', 'in_stock');
SELECT pg_temp.check('une idée porte une offre', (SELECT count(*) FROM public.wish_offers WHERE wish_id = :'w1') = 1);
SET ROLE authenticated;
SELECT pg_temp.as_user(:'B');
SELECT pg_temp.check('Bob ne lit pas les offres d''Ana', (SELECT count(*) FROM public.wish_offers) = 0);
RESET ROLE;

-- Suppression en cascade avec la collection
DELETE FROM public.wish_offers;
DELETE FROM public.collections WHERE id = :'CUISINE';
SELECT pg_temp.check('supprimer la collection supprime ses idées', NOT EXISTS (SELECT 1 FROM public.collection_wishes));

-- anon : rien
SET ROLE anon;
SELECT pg_temp.check('anon : pas de tri', pg_temp.fails(format('SELECT public.triage_collection_wish(%L, %L)', :'w1', 'keep'), 'permission denied for function triage_collection_wish') = 'ok');
SELECT pg_temp.check('anon : pas de lecture', pg_temp.fails('SELECT * FROM public.collection_wishes', 'permission denied for table collection_wishes') = 'ok');
RESET ROLE;
\o
SELECT n, CASE WHEN ok THEN 'OK   ' ELSE 'ÉCHEC' END, test, detail FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS reussis, count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
