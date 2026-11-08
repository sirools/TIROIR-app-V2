-- Tests de checkout_consents.sql. Dernière ligne : nombre d'échecs (0 attendu).
CREATE TEMP TABLE r (n serial, name text, ok bool);
GRANT ALL ON r TO authenticated, service_role, anon; GRANT ALL ON SEQUENCE r_n_seq TO authenticated, service_role, anon;
INSERT INTO auth.users VALUES ('c1000000-0000-0000-0000-000000000000'), ('c2000000-0000-0000-0000-000000000000');

SET ROLE service_role;
INSERT INTO public.checkout_consents (user_id, stripe_session_id, kind, item, consent, text_version, locale, livemode, accepted_at)
VALUES ('c1000000-0000-0000-0000-000000000000', 'cs_1', 'credits', 'credits_150', 'accepted', '2026-11-08', 'fr', false, now());
INSERT INTO public.checkout_consents (user_id, stripe_session_id, kind, item, consent, text_version, locale, livemode, accepted_at)
VALUES ('c1000000-0000-0000-0000-000000000000', 'cs_1', 'credits', 'credits_150', 'accepted', '2026-11-08', 'fr', false, now())
ON CONFLICT (stripe_session_id) DO NOTHING;
INSERT INTO r(name, ok) SELECT 'une ligne par session (rejeu sans doublon)', (SELECT count(*) FROM public.checkout_consents WHERE stripe_session_id = 'cs_1') = 1;
DO $$ BEGIN
  INSERT INTO public.checkout_consents (user_id, stripe_session_id, kind, consent, text_version, livemode, accepted_at)
  VALUES ('c2000000-0000-0000-0000-000000000000', 'cs_2', 'credits', 'declined', 'v', false, now());
  INSERT INTO r(name, ok) VALUES ('seul « accepted » est enregistrable', false);
EXCEPTION WHEN check_violation THEN INSERT INTO r(name, ok) VALUES ('seul « accepted » est enregistrable', true); END $$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub = 'c2000000-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'un autre compte ne voit rien', (SELECT count(*) FROM public.checkout_consents) = 0;
SET request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000000';
INSERT INTO r(name, ok) SELECT 'le compte voit son accord', (SELECT count(*) FROM public.checkout_consents) = 1;
DO $$ BEGIN
  INSERT INTO public.checkout_consents (user_id, stripe_session_id, kind, consent, text_version, livemode, accepted_at)
  VALUES ('c1000000-0000-0000-0000-000000000000', 'cs_3', 'credits', 'accepted', 'v', false, now());
  INSERT INTO r(name, ok) VALUES ('un compte n’écrit pas d’accord lui-même', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r(name, ok) VALUES ('un compte n’écrit pas d’accord lui-même', true); END $$;
RESET ROLE;

SELECT n, name, ok FROM r ORDER BY n;
SELECT count(*) FILTER (WHERE NOT ok) AS echecs FROM r;
