-- Tests de refund_ai_credits_lock.sql (après ai_credits_spend.sql). Dernière ligne : nombre d'échecs (0 attendu).
-- Un compte connecté qui a dépensé des crédits ne peut plus se les rendre lui-même.
CREATE TEMP TABLE r (n serial, name text, ok bool);
GRANT ALL ON r TO authenticated, service_role, anon; GRANT ALL ON SEQUENCE r_n_seq TO authenticated, service_role, anon;
INSERT INTO auth.users VALUES ('d1000000-0000-0000-0000-000000000000');

-- Le serveur crédite le compte, le compte dépense (comme avant le verrou).
SET ROLE service_role;
SELECT public.grant_ai_credits('d1000000-0000-0000-0000-000000000000', 10, 'purchase', 'lock-test');
RESET ROLE;
CREATE TEMP TABLE spend (id uuid);
GRANT ALL ON spend TO authenticated, service_role;
SET ROLE authenticated; SET request.jwt.claim.sub = 'd1000000-0000-0000-0000-000000000000';
INSERT INTO spend SELECT public.consume_ai_credits(4, 'lock-test');
INSERT INTO r(name, ok) SELECT 'dépense de 4 notée', (SELECT id FROM spend) IS NOT NULL;
RESET ROLE;

-- Droits : retirés aux comptes, à anon et à PUBLIC ; gardés pour le serveur.
INSERT INTO r(name, ok) SELECT 'authenticated : plus le droit', NOT has_function_privilege('authenticated', 'public.refund_ai_credits(uuid)', 'EXECUTE');
INSERT INTO r(name, ok) SELECT 'anon : pas le droit', NOT has_function_privilege('anon', 'public.refund_ai_credits(uuid)', 'EXECUTE');
INSERT INTO r(name, ok) SELECT 'service_role : garde le droit', has_function_privilege('service_role', 'public.refund_ai_credits(uuid)', 'EXECUTE');
INSERT INTO r(name, ok) SELECT 'PUBLIC : rien dans les droits', NOT EXISTS (
  SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.refund_ai_credits(uuid)'::regprocedure AND a.grantee = 0);

-- Le compte connecté essaie de se rendre sa dépense : refusé, solde inchangé.
SET ROLE authenticated; SET request.jwt.claim.sub = 'd1000000-0000-0000-0000-000000000000';
DO $$ BEGIN
  PERFORM public.refund_ai_credits((SELECT id FROM spend));
  INSERT INTO r(name, ok) VALUES ('compte : remboursement refusé', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('compte : remboursement refusé', true); END $$;
INSERT INTO r(name, ok) SELECT 'solde toujours 6', public.get_my_ai_credits() = 6;
RESET ROLE;

-- Même chose sans être connecté.
SET ROLE anon;
DO $$ BEGIN
  PERFORM public.refund_ai_credits('00000000-0000-0000-0000-000000000000');
  INSERT INTO r(name, ok) VALUES ('anon : refusé', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('anon : refusé', true); END $$;
RESET ROLE;

-- Aucun remboursement écrit.
INSERT INTO r(name, ok) SELECT 'aucun remboursement dans le journal',
  NOT EXISTS (SELECT 1 FROM public.ai_credit_ledger WHERE user_id = 'd1000000-0000-0000-0000-000000000000' AND reason = 'refund');

-- Rejouable : un second passage ne change rien et ne lève pas d'erreur.
\i :lockfile
INSERT INTO r(name, ok) SELECT 'rejeu : toujours fermé', NOT has_function_privilege('authenticated', 'public.refund_ai_credits(uuid)', 'EXECUTE');

SELECT n, name, ok FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
