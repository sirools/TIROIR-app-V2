-- Tests de ai_credits_spend.sql. Dernière ligne : nombre d'échecs (0 attendu).
CREATE TEMP TABLE r (n serial, name text, ok bool);
GRANT ALL ON r TO authenticated, service_role, anon; GRANT ALL ON SEQUENCE r_n_seq TO authenticated, service_role, anon;

SET ROLE service_role;
SELECT public.grant_ai_credits('cccccccc-0000-0000-0000-000000000000', 20, 'purchase', 'spend-txn');
RESET ROLE;

SET ROLE authenticated; SET request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000000';
-- Quota de 10 : une scène de 4, puis une de 4, passent sur le quota.
CREATE TEMP TABLE s AS SELECT 1 AS k, public.spend_ai_units(4, 'detect_scene') AS j;
INSERT INTO s SELECT 2, public.spend_ai_units(4, 'detect_scene');
INSERT INTO r(name, ok) SELECT 'quota d’abord', (SELECT j->>'source' FROM s WHERE k=2) = 'quota';
-- Reste 2 unités de quota : une scène de 4 passe sur les crédits.
INSERT INTO s SELECT 3, public.spend_ai_units(4, 'detect_scene');
INSERT INTO r(name, ok) SELECT 'puis les crédits', (SELECT j->>'source' FROM s WHERE k=3) = 'credits' AND (SELECT j ? 'ledger_id' FROM s WHERE k=3);
INSERT INTO r(name, ok) SELECT 'crédits débités', public.get_my_ai_credits() = 16;
-- Remboursement de la dépense en crédits : une seule fois.
SELECT public.refund_ai_spend((SELECT j FROM s WHERE k=3));
INSERT INTO r(name, ok) SELECT 'crédits rendus', public.get_my_ai_credits() = 20;
SELECT public.refund_ai_spend((SELECT j FROM s WHERE k=3));
INSERT INTO r(name, ok) SELECT 'rendus une seule fois', public.get_my_ai_credits() = 20;
-- Remboursement d'une dépense sur le quota.
SELECT public.refund_ai_spend((SELECT j FROM s WHERE k=2));
INSERT INTO r(name, ok) SELECT 'quota rendu', (SELECT ai_analyses_used FROM public.profiles WHERE id = auth.uid()) = 4;
-- Trop gros pour le quota restant (6) et pour les crédits (20) : refus.
INSERT INTO s SELECT 4, public.spend_ai_units(100, 'x');
INSERT INTO r(name, ok) SELECT 'refus avec le solde affiché', (SELECT (j->>'ok')::bool = false AND (j->>'credits')::int = 20 FROM s WHERE k=4);
INSERT INTO r(name, ok) SELECT 'rien débité au refus', public.get_my_ai_credits() = 20;

-- Bob, sans crédits, quota épuisé : refus.
SET request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000000';
INSERT INTO s SELECT 5, public.spend_ai_units(10, 'x');
INSERT INTO s SELECT 6, public.spend_ai_units(1, 'x');
INSERT INTO r(name, ok) SELECT 'Bob : quota épuisé, pas de crédits', (SELECT (j->>'ok')::bool = false FROM s WHERE k=6);
-- Bob ne peut pas se faire rendre la dépense en crédits d'Chloé.
SELECT public.refund_ai_spend((SELECT j FROM s WHERE k=3));
SET request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'Chloé inchangée après la tentative de Bob', public.get_my_ai_credits() = 20;
RESET ROLE;

SET ROLE anon;
DO $$ BEGIN
  PERFORM public.spend_ai_units(1, 'x');
  INSERT INTO r(name, ok) VALUES ('anonyme refusé', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('anonyme refusé', true); END $$;
RESET ROLE;

SELECT n, name, ok FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
