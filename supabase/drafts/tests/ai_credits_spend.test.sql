-- Tests de ai_credits_spend.sql. Dernière ligne : nombre d'échecs (0 attendu).
CREATE TEMP TABLE r (n serial, name text, ok bool);
GRANT ALL ON r TO authenticated, service_role, anon; GRANT ALL ON SEQUENCE r_n_seq TO authenticated, service_role, anon;
CREATE TEMP TABLE s (k int, j jsonb);
GRANT ALL ON s TO authenticated, service_role, anon;

SET ROLE service_role;
SELECT public.grant_ai_credits('cccccccc-0000-0000-0000-000000000000', 30, 'purchase', 'spend-txn');
RESET ROLE;

SET ROLE authenticated; SET request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000000';
-- Analyses : quota de 10.
INSERT INTO s SELECT 1, public.spend_ai('detect_scene', 4);
INSERT INTO s SELECT 2, public.spend_ai('detect_scene', 4);
INSERT INTO r(name, ok) SELECT 'analyse : quota d’abord', (SELECT j->>'source' FROM s WHERE k=2) = 'quota';
INSERT INTO s SELECT 3, public.spend_ai('detect_scene', 4);
INSERT INTO r(name, ok) SELECT 'analyse : puis les crédits', (SELECT j->>'source' FROM s WHERE k=3) = 'credits';
INSERT INTO r(name, ok) SELECT 'analyse : 4 crédits débités', public.get_my_ai_credits() = 26;
-- Retouche photo, compte gratuit : fermée par le quota, ouverte par les crédits (4).
INSERT INTO s SELECT 4, public.spend_ai('enhance_photo');
INSERT INTO r(name, ok) SELECT 'photo : un compte gratuit paie en crédits', (SELECT j->>'source' = 'credits' AND (j->>'units')::int = 4 FROM s WHERE k=4);
-- Estimation : quota de 1, puis 8 crédits.
INSERT INTO s SELECT 5, public.spend_ai('estimate_value');
INSERT INTO s SELECT 6, public.spend_ai('estimate_value');
INSERT INTO r(name, ok) SELECT 'estimation : quota puis 8 crédits', (SELECT j->>'source' FROM s WHERE k=5) = 'quota' AND (SELECT j->>'source' = 'credits' AND (j->>'units')::int = 8 FROM s WHERE k=6);
INSERT INTO r(name, ok) SELECT 'solde après tout ça', public.get_my_ai_credits() = 14;
-- Une estimation de plus passe (reste 6 crédits), la suivante est refusée.
INSERT INTO s SELECT 7, public.spend_ai('estimate_value');
INSERT INTO s SELECT 8, public.spend_ai('estimate_value');
INSERT INTO r(name, ok) SELECT 'refus avec le solde et le prix', (SELECT (j->>'ok')::bool = false AND j->>'reason' = 'QUOTA_EXCEEDED' AND (j->>'cost')::int = 8 FROM s WHERE k=8);
INSERT INTO r(name, ok) SELECT 'fonction inconnue refusée', (SELECT count(*) FROM s) = 8;
DO $$ BEGIN
  PERFORM public.spend_ai('inconnue');
  INSERT INTO r(name, ok) VALUES ('fonction inconnue refusée (exception)', false);
EXCEPTION WHEN raise_exception THEN INSERT INTO r(name, ok) VALUES ('fonction inconnue refusée (exception)', true); END $$;

-- LE TROU : le compte ne peut plus se rembourser lui-même.
DO $$ BEGIN
  PERFORM public.refund_ai_quota_units(100);
  INSERT INTO r(name, ok) VALUES ('refund_ai_quota_units fermé au compte', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('refund_ai_quota_units fermé au compte', true); END $$;
DO $$ BEGIN
  PERFORM public.refund_photo_enhance_quota();
  INSERT INTO r(name, ok) VALUES ('refund_photo_enhance_quota fermé au compte', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('refund_photo_enhance_quota fermé au compte', true); END $$;
DO $$ BEGIN
  PERFORM public.refund_value_estimate_quota();
  INSERT INTO r(name, ok) VALUES ('refund_value_estimate_quota fermé au compte', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('refund_value_estimate_quota fermé au compte', true); END $$;
DO $$ BEGIN
  PERFORM public.refund_ai_spend((SELECT (j->>'spend_id')::uuid FROM s WHERE k=3));
  INSERT INTO r(name, ok) VALUES ('refund_ai_spend fermé au compte', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('refund_ai_spend fermé au compte', true); END $$;
DO $$ BEGIN
  INSERT INTO public.ai_spends (user_id, feature, kind, source, units) VALUES (auth.uid(), 'x', 'analysis', 'quota', 1);
  INSERT INTO r(name, ok) VALUES ('journal des dépenses non modifiable', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('journal des dépenses non modifiable', true); END $$;
INSERT INTO r(name, ok) SELECT 'le compte lit ses dépenses', (SELECT count(*) FROM public.ai_spends) = 7;
RESET ROLE;

-- Le serveur rembourse : crédits rendus une fois, quotas rendus.
SET ROLE service_role;
INSERT INTO r(name, ok) SELECT 'serveur : dépense en crédits rendue', public.refund_ai_spend((SELECT (j->>'spend_id')::uuid FROM s WHERE k=6));
INSERT INTO r(name, ok) SELECT 'serveur : une seule fois', NOT public.refund_ai_spend((SELECT (j->>'spend_id')::uuid FROM s WHERE k=6));
INSERT INTO r(name, ok) SELECT 'serveur : quota d’analyse rendu', public.refund_ai_spend((SELECT (j->>'spend_id')::uuid FROM s WHERE k=2));
INSERT INTO r(name, ok) SELECT 'serveur : quota d’estimation rendu', public.refund_ai_spend((SELECT (j->>'spend_id')::uuid FROM s WHERE k=5));
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'crédits revenus à 14', public.get_my_ai_credits() = 14;
INSERT INTO r(name, ok) SELECT 'compteurs rendus', (SELECT ai_analyses_used = 4 AND value_estimate_used = 0 FROM public.profiles WHERE id = auth.uid());
-- Bob ne voit pas les dépenses de Chloé.
SET request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'Bob ne voit rien', (SELECT count(*) FROM public.ai_spends) = 0;
INSERT INTO s SELECT 9, public.spend_ai('enhance_photo');
INSERT INTO r(name, ok) SELECT 'Bob, gratuit sans crédits : retouche refusée (NOT_PREMIUM)', (SELECT j->>'reason' FROM s WHERE k=9) = 'NOT_PREMIUM';
RESET ROLE;

SET ROLE anon;
DO $$ BEGIN
  PERFORM public.spend_ai('detect_scene', 1);
  INSERT INTO r(name, ok) VALUES ('anonyme refusé', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('anonyme refusé', true); END $$;
RESET ROLE;

SELECT n, name, ok FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
