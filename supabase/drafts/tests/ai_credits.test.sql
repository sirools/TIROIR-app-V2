-- Tests de ai_credits.sql. Dernière ligne : nombre d'échecs (0 attendu).
CREATE TEMP TABLE r (n serial, name text, ok bool);
GRANT ALL ON r TO authenticated, service_role, anon; GRANT ALL ON SEQUENCE r_n_seq TO authenticated, service_role, anon;

-- Le serveur crédite Ana : 5 de bienvenue, un achat de 20.
SET ROLE service_role;
INSERT INTO r(name, ok) SELECT 'bienvenue', public.grant_ai_credits('aaaaaaaa-0000-0000-0000-000000000000', 5, 'welcome', 'aaaaaaaa');
INSERT INTO r(name, ok) SELECT 'achat', public.grant_ai_credits('aaaaaaaa-0000-0000-0000-000000000000', 20, 'purchase', 'txn-1');
INSERT INTO r(name, ok) SELECT 'même achat rejoué : rien de plus', NOT public.grant_ai_credits('aaaaaaaa-0000-0000-0000-000000000000', 20, 'purchase', 'txn-1');
INSERT INTO r(name, ok) SELECT 'bienvenue une seule fois', NOT public.grant_ai_credits('aaaaaaaa-0000-0000-0000-000000000000', 5, 'welcome', 'aaaaaaaa');
RESET ROLE;

-- Ana voit son solde, dépense, se fait rendre une dépense une fois.
SET ROLE authenticated; SET request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'solde 25', public.get_my_ai_credits() = 25;
CREATE TEMP TABLE c AS SELECT public.consume_ai_credits(4, 'detect-scene') AS id;
INSERT INTO r(name, ok) SELECT 'dépense de 4', (SELECT id FROM c) IS NOT NULL AND public.get_my_ai_credits() = 21;
INSERT INTO r(name, ok) SELECT 'dépense trop grosse refusée', public.consume_ai_credits(22, 'x') IS NULL;
INSERT INTO r(name, ok) SELECT 'rien débité', public.get_my_ai_credits() = 21;
-- (le solde se relit dans une instruction à part : même instantané sinon)
INSERT INTO r(name, ok) SELECT 'remboursement', public.refund_ai_credits((SELECT id FROM c));
INSERT INTO r(name, ok) SELECT 'solde revenu à 25', public.get_my_ai_credits() = 25;
INSERT INTO r(name, ok) SELECT 'remboursement une seule fois', NOT public.refund_ai_credits((SELECT id FROM c));
INSERT INTO r(name, ok) SELECT 'toujours 25', public.get_my_ai_credits() = 25;
INSERT INTO r(name, ok) SELECT 'Ana lit son journal', (SELECT count(*) FROM public.ai_credit_ledger) = 4;
DO $$ BEGIN
  INSERT INTO public.ai_credit_ledger (user_id, delta, reason) VALUES (auth.uid(), 1000, 'gift');
  INSERT INTO r(name, ok) VALUES ('écriture directe interdite', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('écriture directe interdite', true); END $$;
DO $$ BEGIN
  PERFORM public.grant_ai_credits(auth.uid(), 1000, 'gift', 'moi');
  INSERT INTO r(name, ok) VALUES ('un compte ne se crédite pas lui-même', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('un compte ne se crédite pas lui-même', true); END $$;
DO $$ BEGIN
  PERFORM public.consume_ai_credits(-5, 'x');
  INSERT INTO r(name, ok) VALUES ('montant négatif refusé', false);
EXCEPTION WHEN raise_exception THEN INSERT INTO r(name, ok) VALUES ('montant négatif refusé', true); END $$;
DO $$ BEGIN
  PERFORM public.ai_credit_balance('bbbbbbbb-0000-0000-0000-000000000000');
  INSERT INTO r(name, ok) VALUES ('solde d’un autre illisible', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('solde d’un autre illisible', true); END $$;

-- Bob ne voit rien d'Ana, ne peut pas rembourser la dépense d'Ana.
SET request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'Bob : solde 0, journal vide', public.get_my_ai_credits() = 0 AND (SELECT count(*) FROM public.ai_credit_ledger) = 0;
INSERT INTO r(name, ok) SELECT 'Bob ne rembourse pas la dépense d’Ana', NOT public.refund_ai_credits((SELECT id FROM c));
INSERT INTO r(name, ok) SELECT 'Bob sans crédit ne dépense rien', public.consume_ai_credits(1, 'x') IS NULL;
RESET ROLE;

-- Anonyme : rien.
SET ROLE anon;
DO $$ BEGIN
  PERFORM public.get_my_ai_credits();
  INSERT INTO r(name, ok) VALUES ('anonyme refusé', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('anonyme refusé', true); END $$;
RESET ROLE;

SELECT n, name, ok FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
