-- Tests du brouillon 0001 : trois comptes (Ana, Bob, Chloé), la serrure,
-- les invitations, la lecture partagée, et la RLS existante inchangée.
-- Lancé par run.sh ; affiche un tableau OK / ÉCHEC.
\set ON_ERROR_STOP 1
\o /dev/null
CREATE TEMP TABLE r (n serial, test text, ok bool, detail text);
GRANT ALL ON r TO authenticated, anon; GRANT USAGE ON SEQUENCE r_n_seq TO authenticated, anon;
CREATE FUNCTION pg_temp.check(t text, cond bool, d text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$ INSERT INTO r(test, ok, detail) VALUES (t, coalesce(cond,false), d) $$;
CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', u, false) $$;
CREATE FUNCTION pg_temp.fails(q text, expected text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE q; RETURN 'pas d''erreur';
EXCEPTION WHEN others THEN RETURN CASE WHEN SQLERRM = expected THEN 'ok' ELSE SQLERRM END; END $$;

SET ROLE authenticated;
\set A 'aaaaaaaa-0000-0000-0000-000000000000'
\set B 'bbbbbbbb-0000-0000-0000-000000000000'
\set C 'cccccccc-0000-0000-0000-000000000000'
\set DA 'd0000000-0000-0000-0000-00000000000a'

-- Backfill et trigger
SELECT pg_temp.as_user(:'A');
SELECT pg_temp.check('backfill : Ana est propriétaire', public.drawer_role(:'DA') = 'owner');
RESET ROLE; INSERT INTO public.drawers (id, user_id) VALUES ('d0000000-0000-0000-0000-00000000000b', :'B'); SET ROLE authenticated;
SELECT pg_temp.as_user(:'B');
SELECT pg_temp.check('trigger : Bob propriétaire de son nouveau Tiroir', public.drawer_role('d0000000-0000-0000-0000-00000000000b') = 'owner');

-- Serrure fermée par défaut : Bob ne voit rien
SELECT pg_temp.check('fermé : Bob ne peut pas voir', NOT public.drawer_can(:'DA','voir'));
SELECT pg_temp.check('fermé : lister les objets est refusé', pg_temp.fails($$SELECT * FROM public.list_drawer_objects('d0000000-0000-0000-0000-00000000000a')$$, 'FORBIDDEN') = 'ok');
SELECT pg_temp.check('Bob ne peut pas inviter chez Ana', pg_temp.fails($$SELECT public.create_drawer_invite('d0000000-0000-0000-0000-00000000000a','viewer')$$, 'FORBIDDEN') = 'ok');
SELECT pg_temp.check('Bob ne peut pas changer la serrure d''Ana', pg_temp.fails($$SELECT public.set_drawer_serrure('d0000000-0000-0000-0000-00000000000a','ouvert')$$, 'FORBIDDEN') = 'ok');

-- Ana invite Bob comme éditeur
SELECT pg_temp.as_user(:'A');
SELECT public.create_drawer_invite(:'DA', 'editor') AS tok_b \gset
SELECT pg_temp.check('jeton de 64 caractères hexadécimaux', :'tok_b' ~ '^[0-9a-f]{64}$');
SELECT pg_temp.check('Ana ne peut pas accepter sa propre invitation', pg_temp.fails(format('SELECT public.accept_drawer_invite(%L)', :'tok_b'), 'ALREADY_OWNER') = 'ok');

SELECT pg_temp.as_user(:'B');
SELECT pg_temp.check('Bob accepte', public.accept_drawer_invite(:'tok_b') = :'DA');
SELECT pg_temp.check('un lien ne sert qu''une fois', pg_temp.fails(format('SELECT public.accept_drawer_invite(%L)', :'tok_b'), 'INVALID_INVITE') = 'ok');
SELECT pg_temp.check('jeton inconnu refusé avec le même message', pg_temp.fails($$SELECT public.accept_drawer_invite('nope')$$, 'INVALID_INVITE') = 'ok');
SELECT pg_temp.check('toujours fermé : Bob membre mais n''entre pas', NOT public.drawer_can(:'DA','voir'));
SELECT pg_temp.check('fermé : absent de list_my_drawers de Bob', NOT EXISTS (SELECT 1 FROM public.list_my_drawers() WHERE drawer_id = :'DA'));

-- Ana entrouvre
SELECT pg_temp.as_user(:'A');
SELECT public.set_drawer_serrure(:'DA', 'entrouvert');
SELECT pg_temp.as_user(:'B');
SELECT pg_temp.check('entrouvert : Bob voit', public.drawer_can(:'DA','voir'));
SELECT pg_temp.check('entrouvert : éditeur peut modifier', public.drawer_can(:'DA','modifier'));
SELECT pg_temp.check('entrouvert : éditeur ne peut pas prêter', NOT public.drawer_can(:'DA','preter'));
SELECT pg_temp.check('entrouvert : éditeur ne gère pas les membres', NOT public.drawer_can(:'DA','gerer_membres'));
SELECT pg_temp.check('list_my_drawers de Bob : son Tiroir puis celui d''Ana',
  (SELECT array_agg(role) FROM public.list_my_drawers()) = ARRAY['owner','editor']);
SELECT pg_temp.check('list_my_drawers : nom du propriétaire et compteurs',
  EXISTS (SELECT 1 FROM public.list_my_drawers() WHERE drawer_id = :'DA' AND owner_name = 'Ana' AND object_count = 2 AND collection_count = 1));
SELECT pg_temp.check('list_drawer_objects : 2 objets', (SELECT count(*) FROM public.list_drawer_objects(:'DA')) = 2);
SELECT pg_temp.check('list_drawer_objects : filtre par collection', (SELECT count(*) FROM public.list_drawer_objects(:'DA', 'c0000000-0000-0000-0000-00000000000a')) = 1);
SELECT pg_temp.check('couverture : l''image marquée is_cover', (SELECT cover_path FROM public.list_drawer_objects(:'DA') WHERE title = 'Perceuse') = 'a/1/cover.jpg');
SELECT pg_temp.check('list_drawer_collections', (SELECT name FROM public.list_drawer_collections(:'DA')) = 'Grenier' AND (SELECT object_count FROM public.list_drawer_collections(:'DA')) = 1);
SELECT pg_temp.check('list_drawer_members : Ana puis Bob', (SELECT array_agg(display_name) FROM public.list_drawer_members(:'DA')) = ARRAY['Ana','Bob']);
SELECT pg_temp.check('RLS inchangée : SELECT direct sur objects ne montre pas ceux d''Ana', (SELECT count(*) FROM public.objects WHERE user_id = :'A') = 0);
SELECT pg_temp.check('RLS inchangée : SELECT direct sur drawers ne montre que le sien', (SELECT count(*) FROM public.drawers) = 1);
SELECT pg_temp.check('drawer_members : Bob ne voit que ses clés', (SELECT count(*) FROM public.drawer_members WHERE user_id <> :'B') = 0);

-- Chloé, sans clé
SELECT pg_temp.as_user(:'C');
SELECT pg_temp.check('entrouvert : Chloé sans clé ne voit pas', NOT public.drawer_can(:'DA','voir'));
SELECT pg_temp.as_user(:'A');
SELECT public.set_drawer_serrure(:'DA', 'ouvert');
SELECT pg_temp.as_user(:'C');
SELECT pg_temp.check('ouvert : Chloé voit les objets', (SELECT count(*) FROM public.list_drawer_objects(:'DA')) = 2);
SELECT pg_temp.check('ouvert : Chloé ne peut pas modifier', NOT public.drawer_can(:'DA','modifier'));
SELECT pg_temp.check('ouvert : Chloé ne voit pas la liste des membres', pg_temp.fails($$SELECT * FROM public.list_drawer_members('d0000000-0000-0000-0000-00000000000a')$$, 'FORBIDDEN') = 'ok');
SELECT pg_temp.check('ouvert : pas dans list_my_drawers sans clé', NOT EXISTS (SELECT 1 FROM public.list_my_drawers() WHERE drawer_id = :'DA'));

-- Clé temporaire pour Chloé, qui expire
SELECT pg_temp.as_user(:'A');
SELECT public.set_drawer_serrure(:'DA', 'entrouvert');
SELECT public.create_drawer_invite(:'DA', 'viewer', now() + interval '1 day') AS tok_c \gset
SELECT pg_temp.check('clé déjà expirée refusée', pg_temp.fails(format('SELECT public.create_drawer_invite(%L, %L, now() - interval ''1 day'')', :'DA', 'viewer'), 'KEY_ALREADY_EXPIRED') = 'ok');
SELECT pg_temp.as_user(:'C');
SELECT public.accept_drawer_invite(:'tok_c');
SELECT pg_temp.check('lectrice : voit', public.drawer_can(:'DA','voir'));
SELECT pg_temp.check('lectrice : ne modifie pas', NOT public.drawer_can(:'DA','modifier'));
RESET ROLE; UPDATE public.drawer_members SET expires_at = now() - interval '1 minute' WHERE user_id = :'C'; SET ROLE authenticated;
SELECT pg_temp.as_user(:'C');
SELECT pg_temp.check('clé expirée : ne voit plus', NOT public.drawer_can(:'DA','voir'));

-- Invitation révoquée ou périmée
SELECT pg_temp.as_user(:'A');
SELECT public.create_drawer_invite(:'DA', 'viewer') AS tok_r \gset
SELECT public.revoke_drawer_invite(:'tok_r');
SELECT public.create_drawer_invite(:'DA', 'viewer') AS tok_old \gset
RESET ROLE; UPDATE public.drawer_invites SET invite_expires_at = now() - interval '1 minute' WHERE token = :'tok_old'; SET ROLE authenticated;
SELECT pg_temp.as_user(:'C');
SELECT pg_temp.check('lien révoqué refusé', pg_temp.fails(format('SELECT public.accept_drawer_invite(%L)', :'tok_r'), 'INVALID_INVITE') = 'ok');
SELECT pg_temp.check('lien périmé refusé', pg_temp.fails(format('SELECT public.accept_drawer_invite(%L)', :'tok_old'), 'INVALID_INVITE') = 'ok');
SELECT pg_temp.check('Chloé ne peut pas révoquer', pg_temp.fails(format('SELECT public.revoke_drawer_invite(%L)', :'tok_old'), 'FORBIDDEN') = 'ok');
SELECT pg_temp.check('les invitations ne sont pas lisibles directement', pg_temp.fails('SELECT * FROM public.drawer_invites', 'permission denied for table drawer_invites') = 'ok' OR (SELECT count(*) FROM public.drawer_invites) = 0);

-- Retrait
SELECT pg_temp.as_user(:'C');
SELECT pg_temp.check('Chloé ne peut pas retirer Bob', pg_temp.fails(format('SELECT public.remove_drawer_member(%L, %L)', :'DA', :'B'), 'FORBIDDEN') = 'ok');
SELECT public.remove_drawer_member(:'DA', :'C');
SELECT pg_temp.check('Chloé rend sa clé', public.drawer_role(:'DA') IS NULL);
SELECT pg_temp.as_user(:'A');
SELECT public.remove_drawer_member(:'DA', :'A');
SELECT pg_temp.check('la clé du propriétaire ne se retire pas', public.drawer_role(:'DA') = 'owner');
SELECT public.remove_drawer_member(:'DA', :'B');
SELECT pg_temp.as_user(:'B');
SELECT pg_temp.check('Ana retire Bob', NOT public.drawer_can(:'DA','voir'));

-- anon n'a accès à rien
RESET ROLE; SET ROLE anon;
SELECT pg_temp.check('anon : list_my_drawers refusé', pg_temp.fails('SELECT * FROM public.list_my_drawers()', 'permission denied for function list_my_drawers') = 'ok');
RESET ROLE;
\o
SELECT n, CASE WHEN ok THEN 'OK   ' ELSE 'ÉCHEC' END, test FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS reussis, count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
