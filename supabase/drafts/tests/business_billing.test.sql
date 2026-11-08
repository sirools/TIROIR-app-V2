-- Tests de business_billing.sql. Dernière ligne : nombre d'échecs (0 attendu).
-- aaaa : gratuit, owner ; dddd : gratuit ; eeee : Premium (store) ; bbbb : Pro à la main.
CREATE TEMP TABLE r (n serial, name text, ok bool);
GRANT ALL ON r TO authenticated, service_role, anon; GRANT ALL ON SEQUENCE r_n_seq TO authenticated, service_role, anon;
UPDATE public.profiles SET plan = 'premium' WHERE id = 'eeeeeeee-0000-0000-0000-000000000000';
UPDATE public.profiles SET plan = 'pro', pro_invoice_ref = 'FAC-12', pro_company = 'Atelier' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000000';

SET ROLE service_role;
INSERT INTO public.organizations (id, name, billing_email) VALUES ('0a000000-0000-0000-0000-000000000000', 'Brocante Dupont', 'compta@dupont.fr');
INSERT INTO public.organizations (id, name, billing_email) VALUES ('0b000000-0000-0000-0000-000000000000', 'Autre', 'x@y.fr');
INSERT INTO r(name, ok) SELECT 'owner ajouté', (public.org_add_member('0a000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner', NULL))->>'status' = 'OK';
SELECT public.org_add_member('0a000000-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000000', 'member', 'aaaaaaaa-0000-0000-0000-000000000000');
SELECT public.org_add_member('0a000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-000000000000', 'member', 'aaaaaaaa-0000-0000-0000-000000000000');
INSERT INTO r(name, ok) SELECT '4 sièges', (public.org_add_member('0a000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'admin', NULL))->>'seats' = '4';
INSERT INTO r(name, ok) SELECT 'déjà membre', (public.org_add_member('0a000000-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000000', 'member', NULL))->>'status' = 'ALREADY_MEMBER';
INSERT INTO r(name, ok) SELECT 'une seule organisation à la fois', (public.org_add_member('0b000000-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000000', 'member', NULL))->>'status' = 'IN_OTHER_ORG';
INSERT INTO r(name, ok) SELECT 'pas d’abonnement : personne n’a le Pro', (SELECT plan FROM public.profiles WHERE id = 'dddddddd-0000-0000-0000-000000000000') = 'free';

-- Abonnement actif : droits jusqu'à J+40.
UPDATE public.organizations SET pro_access_until = CURRENT_DATE + 40, subscription_status = 'active' WHERE id = '0a000000-0000-0000-0000-000000000000';
SELECT public.sync_org_entitlements('0a000000-0000-0000-0000-000000000000');
INSERT INTO r(name, ok) SELECT 'actif : les gratuits passent Pro', (SELECT bool_and(plan = 'pro' AND pro_expires_at = CURRENT_DATE + 40 AND pro_company = 'Brocante Dupont') FROM public.profiles WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000000'));
INSERT INTO r(name, ok) SELECT 'Premium existant intact', (SELECT plan = 'premium' AND pro_invoice_ref IS NULL FROM public.profiles WHERE id = 'eeeeeeee-0000-0000-0000-000000000000');
INSERT INTO r(name, ok) SELECT 'Pro à la main intact', (SELECT plan = 'pro' AND pro_invoice_ref = 'FAC-12' AND pro_company = 'Atelier' FROM public.profiles WHERE id = 'bbbbbbbb-0000-0000-0000-000000000000');
INSERT INTO r(name, ok) SELECT 'pro_granted : seulement les deux gratuits', (SELECT count(*) FROM public.org_members WHERE pro_granted) = 2;
INSERT INTO r(name, ok) SELECT 'sync rejouée : rien ne change', public.sync_org_entitlements('0a000000-0000-0000-0000-000000000000') = 0;

-- Membre retiré : redevient gratuit, siège en moins.
INSERT INTO r(name, ok) SELECT 'retrait : 3 sièges', (public.org_remove_member('0a000000-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000000'))->>'seats' = '3';
INSERT INTO r(name, ok) SELECT 'retiré : redevient gratuit', (SELECT plan = 'free' AND pro_invoice_ref IS NULL FROM public.profiles WHERE id = 'dddddddd-0000-0000-0000-000000000000');
INSERT INTO r(name, ok) SELECT 'l’owner ne se retire pas', (public.org_remove_member('0a000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000'))->>'status' = 'OWNER';
INSERT INTO r(name, ok) SELECT 'retiré : peut rejoindre une autre organisation', (public.org_add_member('0b000000-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000000', 'owner', NULL))->>'status' = 'OK';
-- Retiré puis revenu dans la première : réactivé.
-- (l'owner de « Autre » ferme l'organisation depuis le back-office)
UPDATE public.org_members SET status = 'removed', removed_at = now() WHERE org_id = '0b000000-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'revenu : réactivé', (public.org_add_member('0a000000-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000000', 'member', NULL))->>'status' = 'OK';
INSERT INTO r(name, ok) SELECT 'revenu : Pro rendu', (SELECT plan FROM public.profiles WHERE id = 'dddddddd-0000-0000-0000-000000000000') = 'pro';

-- Impayé au-delà de la grâce : droits échus, tout le monde revient à son palier.
UPDATE public.organizations SET pro_access_until = CURRENT_DATE - 1, subscription_status = 'unpaid' WHERE id = '0a000000-0000-0000-0000-000000000000';
SELECT public.sync_org_entitlements('0a000000-0000-0000-0000-000000000000');
INSERT INTO r(name, ok) SELECT 'échu : les membres Pro par l’organisation redeviennent gratuits', (SELECT bool_and(plan = 'free') FROM public.profiles WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000000'));
INSERT INTO r(name, ok) SELECT 'échu : Premium et Pro à la main intacts', (SELECT array_agg(plan ORDER BY id) FROM public.profiles WHERE id IN ('bbbbbbbb-0000-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-000000000000')) = ARRAY['pro', 'premium'];
RESET ROLE;

-- Lecture : un membre voit son organisation et ses collègues, pas les autres.
INSERT INTO public.billing_invoices (stripe_invoice_id, org_id, status, livemode) VALUES ('in_1', '0a000000-0000-0000-0000-000000000000', 'open', false);
SET ROLE authenticated; SET request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'membre : voit son organisation seulement', (SELECT array_agg(name) FROM public.organizations) = ARRAY['Brocante Dupont'];
INSERT INTO r(name, ok) SELECT 'membre : voit ses 4 collègues actifs', (SELECT count(*) FROM public.org_members WHERE status = 'active') = 4;
INSERT INTO r(name, ok) SELECT 'membre simple : pas les factures', (SELECT count(*) FROM public.billing_invoices) = 0;
DO $$ BEGIN
  UPDATE public.org_members SET role = 'owner' WHERE user_id = 'dddddddd-0000-0000-0000-000000000000';
  INSERT INTO r(name, ok) VALUES ('membre : ne change pas son rôle', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('membre : ne change pas son rôle', true); END $$;
DO $$ BEGIN
  PERFORM public.org_add_member('0a000000-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000', 'member', NULL);
  INSERT INTO r(name, ok) VALUES ('membre : n’ajoute personne en direct', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('membre : n’ajoute personne en direct', true); END $$;
SET request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'admin : voit les factures', (SELECT count(*) FROM public.billing_invoices) = 1;
SET request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'inconnu : ne voit rien', (SELECT count(*) FROM public.organizations) + (SELECT count(*) FROM public.org_members) + (SELECT count(*) FROM public.billing_invoices) = 0;
RESET ROLE;

SELECT n, name, ok FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
