-- Tests de stripe_end_keeps_store.sql (après stripe_subscriptions.sql). Dernière ligne : nombre d'échecs (0 attendu).
-- g1 : abonné du site qui a aussi un Pro de l'app ; g2 : abonné du site seul ;
-- g3 : abonné du site dont l'abonnement de l'app est expiré.
CREATE TEMP TABLE r (n serial, name text, ok bool);
GRANT ALL ON r TO authenticated, service_role, anon; GRANT ALL ON SEQUENCE r_n_seq TO authenticated, service_role, anon;
INSERT INTO auth.users VALUES ('a1000000-0000-0000-0000-000000000000'), ('a2000000-0000-0000-0000-000000000000'), ('a3000000-0000-0000-0000-000000000000');
INSERT INTO public.profiles (id) VALUES ('a1000000-0000-0000-0000-000000000000'), ('a2000000-0000-0000-0000-000000000000'), ('a3000000-0000-0000-0000-000000000000');

SET ROLE service_role;
SELECT public.apply_stripe_subscription('a1000000-0000-0000-0000-000000000000', 'cus_G1', 'sub_g1', 'premium', 'active', now() + interval '30 days', false, false, 'monthly');
SELECT public.apply_stripe_subscription('a2000000-0000-0000-0000-000000000000', 'cus_G2', 'sub_g2', 'premium', 'active', now() + interval '30 days', false, false, 'monthly');
SELECT public.apply_stripe_subscription('a3000000-0000-0000-0000-000000000000', 'cus_G3', 'sub_g3', 'pro', 'active', now() + interval '30 days', false, false, 'monthly');
-- Abonnements des stores pris en parallèle (journalisés par le webhook RevenueCat, palier inchangé)
SELECT public.upsert_store_subscription('a1000000-0000-0000-0000-000000000000', 'apple', 'tx_g1', 'pro', 'yearly', 'active', now() + interval '300 days', false);
SELECT public.upsert_store_subscription('a3000000-0000-0000-0000-000000000000', 'google', 'tx_g3', 'premium', 'monthly', 'expired', now() - interval '1 day', false);
INSERT INTO r(name, ok) SELECT 'avant : palier du site', (SELECT plan = 'premium' AND plan_source = 'web' FROM public.profiles WHERE id = 'a1000000-0000-0000-0000-000000000000');

-- Fin de l'abonnement du site
INSERT INTO r(name, ok) SELECT 'site arrêté, Pro de l’app payé : Pro gardé',
  public.apply_stripe_subscription('a1000000-0000-0000-0000-000000000000', 'cus_G1', 'sub_g1', 'premium', 'canceled', now(), false, false) = 'pro (abonnement de l''app gardé)';
INSERT INTO r(name, ok) SELECT 'palier et source repris de l’app', (SELECT plan = 'pro' AND plan_source = 'app' FROM public.profiles WHERE id = 'a1000000-0000-0000-0000-000000000000');
INSERT INTO r(name, ok) SELECT 'site arrêté, rien d’autre : gratuit',
  public.apply_stripe_subscription('a2000000-0000-0000-0000-000000000000', 'cus_G2', 'sub_g2', 'premium', 'canceled', now(), false, false) = 'gratuit (canceled)';
INSERT INTO r(name, ok) SELECT 'gratuit, source effacée', (SELECT plan = 'free' AND plan_source IS NULL FROM public.profiles WHERE id = 'a2000000-0000-0000-0000-000000000000');
INSERT INTO r(name, ok) SELECT 'abonnement de l’app expiré : gratuit',
  public.apply_stripe_subscription('a3000000-0000-0000-0000-000000000000', 'cus_G3', 'sub_g3', 'pro', 'canceled', now(), false, false) = 'gratuit (canceled)';
-- Rejeu de la fin : rien ne change pour g1
SELECT public.apply_stripe_subscription('a1000000-0000-0000-0000-000000000000', 'cus_G1', 'sub_g1', 'premium', 'canceled', now(), false, false);
INSERT INTO r(name, ok) SELECT 'rejeu : Pro de l’app toujours là', (SELECT plan = 'pro' AND plan_source = 'app' FROM public.profiles WHERE id = 'a1000000-0000-0000-0000-000000000000');
RESET ROLE;

SELECT n, name, ok FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
