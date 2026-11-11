-- Tests de share_links_private.sql (après 20260625173437_create_share_links.sql). Dernière ligne : nombre d'échecs (0 attendu).
-- Plus personne ne lit les partages des autres ; le propriétaire garde la main sur les siens.
CREATE TEMP TABLE r (n serial, name text, ok bool);
GRANT ALL ON r TO authenticated, service_role, anon; GRANT ALL ON SEQUENCE r_n_seq TO authenticated, service_role, anon;

-- Deux comptes (stub.sql), un lien chacun, dont un protégé par mot de passe.
INSERT INTO public.share_links (user_id, token, object_ids, options) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000000', 'tokenaaa', '{}', '{"password_protected": true, "password_hash": "abc", "contact_email": "a@example.test"}'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'tokenbbb', '{}', '{}');

-- Droits et règles.
INSERT INTO r(name, ok) SELECT 'anon : aucun droit sur la table', NOT has_table_privilege('anon', 'public.share_links', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE');
INSERT INTO r(name, ok) SELECT 'authenticated : pas de TRUNCATE', NOT has_table_privilege('authenticated', 'public.share_links', 'TRUNCATE');
INSERT INTO r(name, ok) SELECT 'authenticated : lit et écrit', has_table_privilege('authenticated', 'public.share_links', 'SELECT') AND has_table_privilege('authenticated', 'public.share_links', 'UPDATE');
INSERT INTO r(name, ok) SELECT 'la règle publique a disparu', NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'share_links' AND policyname = 'public can read by token');
INSERT INTO r(name, ok) SELECT 'une seule règle, pour authenticated', (SELECT count(*) = 1 AND bool_and(roles = '{authenticated}') FROM pg_policies WHERE tablename = 'share_links');

-- Sans compte : refusé, même en donnant le jeton.
SET ROLE anon;
DO $$ BEGIN
  PERFORM 1 FROM public.share_links WHERE token = 'tokenbbb';
  INSERT INTO r(name, ok) VALUES ('anon : lecture refusée', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('anon : lecture refusée', true); END $$;
RESET ROLE;

-- Compte A : ne voit que son lien.
SET ROLE authenticated; SET request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'A voit son lien', (SELECT count(*) FROM public.share_links) = 1 AND EXISTS (SELECT 1 FROM public.share_links WHERE token = 'tokenaaa');
INSERT INTO r(name, ok) SELECT 'A ne voit pas le lien de B, même par son jeton', NOT EXISTS (SELECT 1 FROM public.share_links WHERE token = 'tokenbbb');
-- A ne modifie ni ne supprime le lien de B.
UPDATE public.share_links SET title = 'pris' WHERE token = 'tokenbbb';
DELETE FROM public.share_links WHERE token = 'tokenbbb';
-- A gère le sien.
UPDATE public.share_links SET title = 'le mien' WHERE token = 'tokenaaa';
INSERT INTO r(name, ok) SELECT 'A modifie son lien', (SELECT title FROM public.share_links WHERE token = 'tokenaaa') = 'le mien';
-- A ne crée pas de lien au nom de B, ni ne lui cède le sien.
DO $$ BEGIN
  INSERT INTO public.share_links (user_id, token, object_ids) VALUES ('bbbbbbbb-0000-0000-0000-000000000000', 'tokenfaux', '{}');
  INSERT INTO r(name, ok) VALUES ('A ne crée pas de lien pour B', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('A ne crée pas de lien pour B', true); END $$;
DO $$ BEGIN
  UPDATE public.share_links SET user_id = 'bbbbbbbb-0000-0000-0000-000000000000' WHERE token = 'tokenaaa';
  INSERT INTO r(name, ok) VALUES ('A ne cède pas son lien à B', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('A ne cède pas son lien à B', true); END $$;
INSERT INTO public.share_links (user_id, token, object_ids) VALUES ('aaaaaaaa-0000-0000-0000-000000000000', 'tokenaa2', '{}');
DELETE FROM public.share_links WHERE token = 'tokenaa2';
INSERT INTO r(name, ok) SELECT 'A crée puis supprime un lien à lui', NOT EXISTS (SELECT 1 FROM public.share_links WHERE token = 'tokenaa2');
RESET ROLE;

-- Le lien de B est intact.
INSERT INTO r(name, ok) SELECT 'le lien de B est intact', EXISTS (SELECT 1 FROM public.share_links WHERE token = 'tokenbbb' AND title IS NULL);

-- Le serveur (clé service) lit toujours un partage par son jeton.
SET ROLE service_role;
INSERT INTO r(name, ok) SELECT 'service_role lit tous les liens', (SELECT count(*) FROM public.share_links) = 2;
RESET ROLE;

-- Rejouable : un second passage ne change rien et ne lève pas d'erreur.
\i :privatefile
INSERT INTO r(name, ok) SELECT 'rejeu : toujours fermé', NOT has_table_privilege('anon', 'public.share_links', 'SELECT')
  AND (SELECT count(*) FROM pg_policies WHERE tablename = 'share_links') = 1;

SELECT n, name, ok FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
