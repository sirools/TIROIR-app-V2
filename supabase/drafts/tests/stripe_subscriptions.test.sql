-- Tests de stripe_subscriptions.sql (après business_billing.sql). Dernière ligne : nombre d'échecs (0 attendu).
-- f1 : gratuit qui s'abonne sur le site ; f2 : Premium de l'app ; f3 : Pro sur facture valide.
CREATE TEMP TABLE r (n serial, name text, ok bool);
GRANT ALL ON r TO authenticated, service_role, anon; GRANT ALL ON SEQUENCE r_n_seq TO authenticated, service_role, anon;
INSERT INTO auth.users VALUES ('f1000000-0000-0000-0000-000000000000'), ('f2000000-0000-0000-0000-000000000000'), ('f3000000-0000-0000-0000-000000000000');
INSERT INTO public.profiles (id) VALUES ('f1000000-0000-0000-0000-000000000000'), ('f2000000-0000-0000-0000-000000000000'), ('f3000000-0000-0000-0000-000000000000');
UPDATE public.profiles SET plan = 'premium' WHERE id = 'f2000000-0000-0000-0000-000000000000';
UPDATE public.profiles SET plan = 'pro', pro_invoice_ref = 'FAC-9', pro_expires_at = CURRENT_DATE + 30 WHERE id = 'f3000000-0000-0000-0000-000000000000';

SET ROLE service_role;
-- Porte d'entrée de Checkout
INSERT INTO r(name, ok) SELECT 'gratuit : peut s’abonner', public.stripe_subscription_gate('f1000000-0000-0000-0000-000000000000') = 'OK';
INSERT INTO r(name, ok) SELECT 'Premium de l’app : refusé', public.stripe_subscription_gate('f2000000-0000-0000-0000-000000000000') = 'OTHER';
INSERT INTO r(name, ok) SELECT 'Pro sur facture : refusé', public.stripe_subscription_gate('f3000000-0000-0000-0000-000000000000') = 'OTHER';
INSERT INTO r(name, ok) SELECT 'compte inconnu', public.stripe_subscription_gate('99999999-0000-0000-0000-000000000000') = 'UNKNOWN';

-- Client Stripe : un seul par mode
INSERT INTO r(name, ok) SELECT 'client posé', public.set_stripe_customer('f1000000-0000-0000-0000-000000000000', 'cus_A', false) = 'cus_A';
INSERT INTO r(name, ok) SELECT 'client gardé (course entre deux onglets)', public.set_stripe_customer('f1000000-0000-0000-0000-000000000000', 'cus_B', false) = 'cus_A';

-- Paiement réussi → Premium
INSERT INTO r(name, ok) SELECT 'actif → premium', public.apply_stripe_subscription('f1000000-0000-0000-0000-000000000000', 'cus_A', 'sub_1', 'premium', 'active', now() + interval '30 days', false, false) = 'premium (active)';
INSERT INTO r(name, ok) SELECT 'palier et source', (SELECT plan = 'premium' AND plan_source = 'web' AND stripe_subscription_id = 'sub_1' FROM public.profiles WHERE id = 'f1000000-0000-0000-0000-000000000000');
INSERT INTO r(name, ok) SELECT 'déjà abonné : portail', public.stripe_subscription_gate('f1000000-0000-0000-0000-000000000000') = 'WEB';
-- Rejeu : même résultat
SELECT public.apply_stripe_subscription('f1000000-0000-0000-0000-000000000000', 'cus_A', 'sub_1', 'premium', 'active', now() + interval '30 days', false, false);
INSERT INTO r(name, ok) SELECT 'rejeu : rien ne change', (SELECT plan = 'premium' AND subscription_status = 'active' FROM public.profiles WHERE id = 'f1000000-0000-0000-0000-000000000000');

-- Paiement échoué → en retard, accès gardé
SELECT public.apply_stripe_subscription('f1000000-0000-0000-0000-000000000000', 'cus_A', 'sub_1', 'premium', 'past_due', now() + interval '30 days', false, false);
INSERT INTO r(name, ok) SELECT 'past_due : accès gardé', (SELECT plan = 'premium' AND subscription_status = 'past_due' FROM public.profiles WHERE id = 'f1000000-0000-0000-0000-000000000000');

-- Changement d'offre dans le portail → Pro
SELECT public.apply_stripe_subscription('f1000000-0000-0000-0000-000000000000', 'cus_A', 'sub_1', 'pro', 'active', now() + interval '30 days', false, false);
INSERT INTO r(name, ok) SELECT 'portail : passage au Pro', (SELECT plan = 'pro' FROM public.profiles WHERE id = 'f1000000-0000-0000-0000-000000000000');

-- Résiliation programmée : accès jusqu'à la fin de la période
SELECT public.apply_stripe_subscription('f1000000-0000-0000-0000-000000000000', 'cus_A', 'sub_1', 'pro', 'active', now() + interval '30 days', true, false);
INSERT INTO r(name, ok) SELECT 'résiliation programmée : toujours Pro', (SELECT plan = 'pro' AND subscription_cancel_at_period_end FROM public.profiles WHERE id = 'f1000000-0000-0000-0000-000000000000');

-- Un ancien abonnement qui s'arrête n'écrase pas le courant
INSERT INTO r(name, ok) SELECT 'ancien abonnement ignoré', public.apply_stripe_subscription('f1000000-0000-0000-0000-000000000000', 'cus_A', 'sub_0', 'premium', 'canceled', now(), false, false) = 'ignoré (ancien abonnement)';
INSERT INTO r(name, ok) SELECT 'ancien : toujours Pro', (SELECT plan = 'pro' AND stripe_subscription_id = 'sub_1' FROM public.profiles WHERE id = 'f1000000-0000-0000-0000-000000000000');

-- Fin de période : supprimé → gratuit
SELECT public.apply_stripe_subscription('f1000000-0000-0000-0000-000000000000', 'cus_A', 'sub_1', 'pro', 'canceled', now(), true, false);
INSERT INTO r(name, ok) SELECT 'canceled → gratuit', (SELECT plan = 'free' AND plan_source IS NULL AND subscription_status = 'canceled' FROM public.profiles WHERE id = 'f1000000-0000-0000-0000-000000000000');
INSERT INTO r(name, ok) SELECT 'peut se réabonner', public.stripe_subscription_gate('f1000000-0000-0000-0000-000000000000') = 'OK';
-- Événement « actif » en retard, relu chez Stripe : le webhook passe l'état actuel (canceled), donc rien ne revient.

-- Premium de l'app : un abonnement web qui s'arrête ne le retire pas
UPDATE public.profiles SET plan_source = 'app' WHERE id = 'f2000000-0000-0000-0000-000000000000';
SELECT public.apply_stripe_subscription('f2000000-0000-0000-0000-000000000000', 'cus_C', 'sub_2', 'premium', 'incomplete_expired', NULL, false, false);
INSERT INTO r(name, ok) SELECT 'app : Premium gardé', (SELECT plan = 'premium' AND plan_source = 'app' FROM public.profiles WHERE id = 'f2000000-0000-0000-0000-000000000000');

-- Pro sur facture valide : abonnement noté, palier gardé
INSERT INTO r(name, ok) SELECT 'Pro sur facture gardé', public.apply_stripe_subscription('f3000000-0000-0000-0000-000000000000', 'cus_D', 'sub_3', 'premium', 'active', now() + interval '30 days', false, false) = 'abonnement noté, Pro existant gardé';
INSERT INTO r(name, ok) SELECT 'Pro sur facture : intact', (SELECT plan = 'pro' AND pro_invoice_ref = 'FAC-9' FROM public.profiles WHERE id = 'f3000000-0000-0000-0000-000000000000');

-- Journal des abonnements
INSERT INTO r(name, ok) SELECT 'journal : une ligne Stripe par abonnement', (SELECT count(*) FROM public.subscriptions WHERE user_id = 'f1000000-0000-0000-0000-000000000000' AND source = 'stripe') = 2;
INSERT INTO r(name, ok) SELECT 'journal : sub_1 canceled, palier pro', (SELECT status = 'canceled' AND tier = 'pro' FROM public.subscriptions WHERE external_id = 'sub_1');
SELECT public.upsert_store_subscription('f2000000-0000-0000-0000-000000000000', 'apple', 'tx_1', 'premium', 'monthly', 'active', now() + interval '30 days', false);
SELECT public.upsert_store_subscription('f2000000-0000-0000-0000-000000000000', 'apple', 'tx_1', 'premium', NULL, 'expired', NULL, false);
INSERT INTO r(name, ok) SELECT 'journal store : mis à jour, période gardée', (SELECT status = 'expired' AND period = 'monthly' AND current_period_end IS NOT NULL FROM public.subscriptions WHERE source = 'apple' AND external_id = 'tx_1');
INSERT INTO r(name, ok) SELECT 'journal store : palier du compte inchangé', (SELECT plan = 'premium' FROM public.profiles WHERE id = 'f2000000-0000-0000-0000-000000000000');
SELECT public.upsert_store_subscription('99999999-0000-0000-0000-000000000000', 'google', 'gpa_1', 'pro', 'monthly', 'active', NULL, false);
INSERT INTO r(name, ok) SELECT 'journal store : compte inconnu ignoré', NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE external_id = 'gpa_1');

-- Palier invalide refusé
DO $$ BEGIN
  PERFORM public.apply_stripe_subscription('f1000000-0000-0000-0000-000000000000', 'cus_A', 'sub_1', 'business', 'active', now(), false, false);
  INSERT INTO r(name, ok) VALUES ('palier invalide refusé', false);
EXCEPTION WHEN raise_exception THEN INSERT INTO r(name, ok) VALUES ('palier invalide refusé', true); END $$;
RESET ROLE;

-- Un compte ne peut ni appeler ces fonctions ni écrire ces colonnes
SET ROLE authenticated;
SET request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'compte : ne lit que ses abonnements', (SELECT count(*) FROM public.subscriptions) = 2 AND (SELECT bool_and(user_id = 'f1000000-0000-0000-0000-000000000000') FROM public.subscriptions);
DO $$ BEGIN
  PERFORM public.apply_stripe_subscription('f1000000-0000-0000-0000-000000000000', 'cus_A', 'sub_1', 'pro', 'active', now(), false, false);
  INSERT INTO r(name, ok) VALUES ('compte : pas d’abonnement en direct', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('compte : pas d’abonnement en direct', true); END $$;
DO $$ BEGIN
  PERFORM public.set_stripe_customer('f1000000-0000-0000-0000-000000000000', 'cus_X', false);
  INSERT INTO r(name, ok) VALUES ('compte : pas de client en direct', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('compte : pas de client en direct', true); END $$;
RESET ROLE;

SELECT n, name, ok FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
