-- ================================================================
-- site_pageviews
-- Tracking léger des visites web anonymes pour le dashboard admin.
-- Écrit uniquement côté serveur via SUPABASE_SERVICE_ROLE_KEY.
-- ================================================================

CREATE TABLE public.site_pageviews (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  path            TEXT        NOT NULL,
  referrer        TEXT,
  user_agent      TEXT,
  ip_hash         TEXT,
  visitor_id      TEXT,
  source          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_pageviews ENABLE ROW LEVEL SECURITY;

CREATE INDEX site_pageviews_created_idx
  ON public.site_pageviews (created_at DESC);

CREATE INDEX site_pageviews_path_created_idx
  ON public.site_pageviews (path, created_at DESC);

CREATE INDEX site_pageviews_visitor_created_idx
  ON public.site_pageviews (visitor_id, created_at DESC);

REVOKE ALL ON TABLE public.site_pageviews FROM PUBLIC, anon, authenticated;
