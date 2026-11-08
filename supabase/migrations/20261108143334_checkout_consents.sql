-- ================================================================
-- checkout_consents.sql — preuve du renoncement au droit de rétractation.
-- Version finale du 08/11/2026 : additive (une table), sans DROP,
-- rejouable.
--
-- Au Checkout Stripe (abonnement ou pack de crédits), le client coche une
-- case obligatoire, non pré-cochée : il demande l'accès immédiat et
-- reconnaît perdre son droit de rétractation de 14 jours (art. L221-28 du
-- Code de la consommation). Stripe renvoie l'accord dans la session
-- (consent.terms_of_service = accepted) ; le webhook l'enregistre ici,
-- une fois par session, avec la date et la version du texte affiché.
--
-- Écrit par le serveur seul (clé service) ; un compte lit ses propres
-- accords.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.checkout_consents (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_session_id  TEXT        NOT NULL UNIQUE,     -- cs_…
  kind               TEXT        NOT NULL CHECK (kind IN ('subscription', 'credits')),
  item               TEXT,                            -- premium_monthly, credits_150…
  consent            TEXT        NOT NULL CHECK (consent IN ('accepted')),
  text_version       TEXT        NOT NULL,            -- version du texte affiché (date)
  locale             TEXT,
  livemode           BOOLEAN     NOT NULL,
  accepted_at        TIMESTAMPTZ NOT NULL,            -- fin du Checkout (session complétée)
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkout_consents_user_idx ON public.checkout_consents (user_id, accepted_at DESC);
ALTER TABLE public.checkout_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.checkout_consents TO authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'checkout_consents' AND policyname = 'checkout_consents: select own') THEN
    CREATE POLICY "checkout_consents: select own" ON public.checkout_consents
      FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.checkout_consents IS
  'Renoncement au droit de rétractation (art. L221-28) accepté au Checkout Stripe : une ligne par session, écrite par le webhook.';
