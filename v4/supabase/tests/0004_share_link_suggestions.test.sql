-- Tests du brouillon 0004 : réglage par partage, objets proposés depuis son Tiroir.
-- Lancé par run.sh APRÈS 0003 et ses tests ; affiche un tableau OK / ÉCHEC.
\set ON_ERROR_STOP 1
\o /dev/null
CREATE TEMP TABLE r (n serial, test text, ok bool, detail text);
GRANT ALL ON r TO authenticated, anon, service_role; GRANT USAGE ON SEQUENCE r_n_seq TO authenticated, anon, service_role;
CREATE FUNCTION pg_temp.check(t text, cond bool, d text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$ INSERT INTO r(test, ok, detail) VALUES (t, coalesce(cond,false), d) $$;
CREATE FUNCTION pg_temp.fails(q text, expected text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE q; RETURN 'pas d''erreur';
EXCEPTION WHEN others THEN RETURN CASE WHEN SQLERRM = expected THEN 'ok' ELSE SQLERRM END; END $$;

\set A 'aaaaaaaa-0000-0000-0000-000000000000'
\set B 'bbbbbbbb-0000-0000-0000-000000000000'
\set C 'cccccccc-0000-0000-0000-000000000000'

-- Situation de départ (préparée par run.sh) : collection Cuisine recréée,
-- activée par le drapeau de 0003 ; lien « cuisine » sans option.
SELECT pg_temp.check('report : le lien d''une collection activée est ouvert aux ajouts',
  (SELECT (options ->> 'allow_suggestions')::boolean FROM public.share_links WHERE token = 'cuisine'));
SELECT pg_temp.check('report : les liens hors Cuisine restent fermés',
  NOT EXISTS (SELECT 1 FROM public.share_links WHERE token IN ('melange','velo') AND (options ->> 'allow_suggestions')::boolean));

-- Le réglage du lien fait foi, plus celui de la collection
-- (0004 a déjà éteint le drapeau par collection)
SET ROLE service_role;
SELECT (public.create_collection_suggestion('cuisine', :'B', 'Couteau')).id AS w1 \gset
SELECT pg_temp.check('option du lien active : suggestion acceptée', :'w1' IS NOT NULL);
RESET ROLE;
UPDATE public.share_links SET options = options || '{"allow_suggestions": false}' WHERE token = 'cuisine';
SET ROLE service_role;
SELECT pg_temp.check('option du lien désactivée : refusé',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'cuisine', :'B', 'X'), 'SUGGESTIONS_DISABLED') = 'ok');
RESET ROLE;
UPDATE public.share_links SET options = options || '{"allow_suggestions": true}' WHERE token IN ('cuisine', 'melange');
SET ROLE service_role;
SELECT pg_temp.check('lien sans collection unique : refusé même ouvert',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'melange', :'B', 'X'), 'SUGGESTIONS_DISABLED') = 'ok');

-- Objet proposé depuis son Tiroir
SELECT (public.create_collection_suggestion('cuisine', :'B', NULL, NULL, NULL, 'EUR', 'b0000000-0000-0000-0000-0000000000b1')).id AS w2 \gset
SELECT pg_temp.check('objet de Bob : titre repris de son Tiroir',
  (SELECT title = 'Wok de Bob' AND source_object_id = 'b0000000-0000-0000-0000-0000000000b1' FROM public.collection_wishes WHERE id = :'w2'));
SELECT pg_temp.check('le même objet ne se propose pas deux fois',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, NULL, NULL, NULL, %L, %L)', 'cuisine', :'B', 'EUR', 'b0000000-0000-0000-0000-0000000000b1'), 'ALREADY_SUGGESTED') = 'ok');
SELECT pg_temp.check('on ne propose pas l''objet d''un autre',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, NULL, NULL, NULL, %L, %L)', 'cuisine', :'C', 'EUR', 'b0000000-0000-0000-0000-0000000000b1'), 'SOURCE_NOT_FOUND') = 'ok');
SELECT pg_temp.check('objet inconnu refusé',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, NULL, NULL, NULL, %L, %L)', 'cuisine', :'B', 'EUR', gen_random_uuid()), 'SOURCE_NOT_FOUND') = 'ok');
SELECT pg_temp.check('sans titre ni objet : refusé',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L)', 'cuisine', :'B'), 'null value in column "title" of relation "collection_wishes" violates not-null constraint') = 'ok');
RESET ROLE;
UPDATE public.collection_wishes SET status = 'dismissed' WHERE id = :'w2';
SET ROLE service_role;
SELECT pg_temp.check('après écart, l''objet peut être reproposé',
  (public.create_collection_suggestion('cuisine', :'B', NULL, NULL, NULL, 'EUR', 'b0000000-0000-0000-0000-0000000000b1')).id IS NOT NULL);
RESET ROLE;

-- Suppression de l'objet source : la suggestion reste
DELETE FROM public.objects WHERE id = 'b0000000-0000-0000-0000-0000000000b1';
SELECT pg_temp.check('objet source supprimé : la suggestion garde son titre',
  EXISTS (SELECT 1 FROM public.collection_wishes WHERE title = 'Wok de Bob' AND source_object_id IS NULL));

-- Droits
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'B', false);
SELECT pg_temp.check('authenticated : création directe toujours refusée',
  pg_temp.fails(format('SELECT public.create_collection_suggestion(%L, %L, %L)', 'cuisine', :'B', 'X'), 'permission denied for function create_collection_suggestion') = 'ok');
RESET ROLE;
SELECT pg_temp.check('l''ancienne signature a disparu',
  NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_collection_suggestion' AND pronargs = 6));
\o
SELECT n, CASE WHEN ok THEN 'OK   ' ELSE 'ÉCHEC' END, test, detail FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS reussis, count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
