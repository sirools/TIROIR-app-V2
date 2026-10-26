-- Tests de stripe_credits.sql. Dernière ligne : nombre d'échecs (0 attendu).
CREATE TEMP TABLE r (n serial, name text, ok bool);
GRANT ALL ON r TO authenticated, service_role, anon; GRANT ALL ON SEQUENCE r_n_seq TO authenticated, service_role, anon;

-- Fanny (ffff, nouveau compte) achète 150 crédits à 6,99 € sur le site.
INSERT INTO auth.users VALUES ('ffffffff-0000-0000-0000-000000000000');
SET ROLE service_role;
INSERT INTO r(name, ok) SELECT 'achat : crédité', public.record_stripe_credit_purchase('cs_1', 'pi_1', 'ffffffff-0000-0000-0000-000000000000', 'a@x.fr', 'credits_150', 150, 699, 'eur', 'card', false);
INSERT INTO r(name, ok) SELECT 'achat rejoué : pas de double crédit', NOT public.record_stripe_credit_purchase('cs_1', 'pi_1', 'ffffffff-0000-0000-0000-000000000000', 'a@x.fr', 'credits_150', 150, 699, 'eur', 'card', false);
INSERT INTO r(name, ok) SELECT 'une seule ligne d’achat', (SELECT count(*) FROM public.stripe_credit_purchases) = 1;
INSERT INTO r(name, ok) SELECT 'solde 150', public.ai_credit_balance('ffffffff-0000-0000-0000-000000000000') = 150;
-- Remboursement partiel (moitié), puis rejoué, puis total.
INSERT INTO r(name, ok) SELECT 'remboursement partiel : 75 crédits repris (150 × 350 / 699, arrondi bas)', public.reverse_stripe_credit_purchase('pi_1', 350) = 75;
INSERT INTO r(name, ok) SELECT 'rejoué : rien de plus', public.reverse_stripe_credit_purchase('pi_1', 350) = 0;
INSERT INTO r(name, ok) SELECT 'événement en retard (montant plus petit) : rien', public.reverse_stripe_credit_purchase('pi_1', 100) = 0;
INSERT INTO r(name, ok) SELECT 'statut partiel', (SELECT status FROM public.stripe_credit_purchases WHERE checkout_session_id = 'cs_1') = 'partially_refunded';
INSERT INTO r(name, ok) SELECT 'remboursement total : le reste', public.reverse_stripe_credit_purchase('pi_1', 699) = 75;
INSERT INTO r(name, ok) SELECT 'solde 0', public.ai_credit_balance('ffffffff-0000-0000-0000-000000000000') = 0;
INSERT INTO r(name, ok) SELECT 'statut remboursé', (SELECT status FROM public.stripe_credit_purchases WHERE checkout_session_id = 'cs_1') = 'refunded';
INSERT INTO r(name, ok) SELECT 'paiement inconnu (facture Business) : NULL', public.reverse_stripe_credit_purchase('pi_inconnu', 100) IS NULL;
-- Achat puis dépense, puis remboursement : le solde passe sous zéro.
SELECT public.record_stripe_credit_purchase('cs_2', 'pi_2', 'bbbbbbbb-0000-0000-0000-000000000000', 'b@x.fr', 'credits_50', 50, 299, 'eur', 'card', false);
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000000';
SELECT public.consume_ai_credits(30, 'detect_scene');
INSERT INTO r(name, ok) SELECT 'Bob voit son achat, pas celui de Fanny', (SELECT array_agg(checkout_session_id) FROM public.stripe_credit_purchases) = ARRAY['cs_2'];
RESET ROLE;
SET ROLE service_role;
SELECT public.reverse_stripe_credit_purchase('pi_2', 299);
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'remboursé après dépense : solde négatif', public.get_my_ai_credits() = -30;
INSERT INTO r(name, ok) SELECT 'solde négatif : plus de dépense en crédits', public.consume_ai_credits(1, 'detect_scene') IS NULL;
INSERT INTO r(name, ok) SELECT 'historique : achat, dépense, reprise', (SELECT array_agg(reason ORDER BY at) FROM public.get_my_credit_history(10)) = ARRAY['purchase', 'consume', 'reversal'];
INSERT INTO r(name, ok) SELECT 'historique : l’achat vient du site', (SELECT detail FROM public.get_my_credit_history(10) WHERE reason = 'purchase') = 'site';
-- Le quota du mois apparaît dans l'historique, sans toucher au solde.
SET request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'historique : le quota du mois apparaît', EXISTS (SELECT 1 FROM public.get_my_credit_history(50) WHERE reason = 'quota');
-- Sécurité : le compte ne crédite ni ne reprend rien lui-même.
DO $$ BEGIN
  PERFORM public.record_stripe_credit_purchase('cs_x', 'pi_x', 'cccccccc-0000-0000-0000-000000000000', null, 'credits_500', 500, 0, 'eur', 'card', false);
  INSERT INTO r(name, ok) VALUES ('achat fermé au compte', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('achat fermé au compte', true); END $$;
DO $$ BEGIN
  PERFORM public.reverse_stripe_credit_purchase('pi_2', 0);
  INSERT INTO r(name, ok) VALUES ('reprise fermée au compte', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('reprise fermée au compte', true); END $$;
DO $$ BEGIN
  PERFORM count(*) FROM public.stripe_events;
  INSERT INTO r(name, ok) VALUES ('événements Stripe illisibles', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('événements Stripe illisibles', true); END $$;
DO $$ BEGIN
  INSERT INTO public.ai_credit_ledger (user_id, delta, reason) VALUES ('cccccccc-0000-0000-0000-000000000000', 1000, 'purchase');
  INSERT INTO r(name, ok) VALUES ('journal fermé en écriture', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('journal fermé en écriture', true); END $$;
RESET ROLE;
-- Une reprise est toujours négative.
DO $$ BEGIN
  INSERT INTO public.ai_credit_ledger (user_id, delta, reason, ref) VALUES ('cccccccc-0000-0000-0000-000000000000', 5, 'reversal', 'x');
  INSERT INTO r(name, ok) VALUES ('reprise positive refusée', false);
EXCEPTION WHEN check_violation THEN INSERT INTO r(name, ok) VALUES ('reprise positive refusée', true); END $$;

SELECT n, name, ok FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
