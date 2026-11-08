-- Événements Stripe déjà traités (extrait de supabase/drafts/stripe_credits.sql,
-- appliqué seul en prod le 08/11/2026 pour ouvrir les abonnements avant les
-- crédits) : le webhook ne traite chaque événement qu'une fois.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id           TEXT        PRIMARY KEY,           -- evt_…
  type         TEXT        NOT NULL,
  livemode     BOOLEAN     NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error        TEXT
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_events FROM PUBLIC, anon, authenticated;
