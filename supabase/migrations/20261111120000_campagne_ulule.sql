-- ================================================================
-- 20261111120000_campagne_ulule.sql
-- Campagne Ulule : ambassadeurs, clics sur leurs liens, contributions
-- importées depuis l'export Ulule, journal des e-mails envoyés.
--
-- Aucune politique RLS : tout passe par le serveur, avec la clé service,
-- derrière requireTorixOwnerApi. Ni anon ni authenticated n'y touchent.
--
-- On ne garde que le nécessaire : ni adresse postale, ni contrepartie,
-- ni adresse IP ; du referrer, seulement le site d'origine.
-- ================================================================

CREATE TABLE public.ulule_campaign (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  launch_at      TIMESTAMPTZ NOT NULL DEFAULT '2027-01-12 08:00:00+01',
  page_url       TEXT NOT NULL DEFAULT 'https://fr.ulule.com/tiroir-app/',
  presale_number TEXT NOT NULL DEFAULT '240562',
  -- Statuts de l'export qui valent paiement réel. Ceux de la documentation
  -- de l'API ; d'autres libellés s'ajoutent depuis l'aperçu de l'import.
  paid_statuses  TEXT[] NOT NULL DEFAULT ARRAY['payment-completed', 'payment-done']
);
INSERT INTO public.ulule_campaign (id) VALUES (1);

CREATE TABLE public.ambassadors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL DEFAULT '',
  email             TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  slug              TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  unsubscribed_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.link_clicks (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       TEXT NOT NULL REFERENCES public.ambassadors (slug)
               ON UPDATE CASCADE ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  referrer   TEXT
);
CREATE INDEX link_clicks_slug_idx ON public.link_clicks (slug);

CREATE TABLE public.contributions (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ulule_order_id    TEXT NOT NULL UNIQUE,
  contributor_name  TEXT NOT NULL DEFAULT '',
  contributor_email TEXT CHECK (contributor_email = lower(contributor_email)),
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  status            TEXT NOT NULL,
  is_paid           BOOLEAN NOT NULL DEFAULT FALSE,
  contributed_at    TIMESTAMPTZ,
  ambassador_slug   TEXT REFERENCES public.ambassadors (slug)
                      ON UPDATE CASCADE ON DELETE SET NULL,
  utm_source        TEXT,
  utm_medium        TEXT,
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contributions_email_idx ON public.contributions (contributor_email);
CREATE INDEX contributions_ambassador_idx ON public.contributions (ambassador_slug);

-- Journal des envois. La contrainte d'unicité est ce qui garantit « une
-- seule fois par personne », même si deux imports se croisent : on réserve
-- la ligne AVANT d'appeler Resend.
CREATE TABLE public.ulule_emails (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('prelaunch', 'thanks')),
  recipient_email TEXT NOT NULL CHECK (recipient_email = lower(recipient_email)),
  ambassador_id   UUID REFERENCES public.ambassadors (id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_id     TEXT,
  error           TEXT,
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  first_click_at  TIMESTAMPTZ,
  bounced_at      TIMESTAMPTZ,
  complained_at   TIMESTAMPTZ,
  open_count      INTEGER NOT NULL DEFAULT 0,
  click_count     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (kind, recipient_email)
);
CREATE INDEX ulule_emails_provider_idx ON public.ulule_emails (provider_id) WHERE provider_id IS NOT NULL;

-- Personnes effacées sur demande. L'export Ulule étant cumulatif, le
-- prochain import les recréerait et leur renverrait un e-mail : on garde
-- donc seulement l'empreinte de l'adresse, pour les écarter.
CREATE TABLE public.ulule_forgotten (
  email_sha256 TEXT PRIMARY KEY,
  forgotten_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ulule_campaign  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassadors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ulule_emails    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ulule_forgotten ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ulule_campaign, public.ambassadors, public.link_clicks,
  public.contributions, public.ulule_emails, public.ulule_forgotten
  FROM PUBLIC, anon, authenticated;

-- ── Qui reste à servir ────────────────────────────────────────────
-- Une personne qui a déjà une ligne au journal, quel qu'en soit l'état,
-- n'est pas reprise : un échec se relance explicitement depuis l'admin.

CREATE OR REPLACE FUNCTION public.ulule_next_recipients(p_kind TEXT, p_limit INTEGER)
RETURNS TABLE (email TEXT, name TEXT, ambassador_id UUID, slug TEXT, unsubscribe_token UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
  SELECT a.email, a.first_name, a.id, a.slug, a.unsubscribe_token
    FROM public.ambassadors a
   WHERE p_kind = 'prelaunch'
     AND a.unsubscribed_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.ulule_emails e
                      WHERE e.kind = 'prelaunch' AND e.recipient_email = a.email)
  UNION ALL
  SELECT c.contributor_email, c.contributor_name, NULL::uuid, NULL::text, NULL::uuid
    FROM (
      SELECT DISTINCT ON (contributor_email) contributor_email, contributor_name, contributed_at
        FROM public.contributions
       WHERE is_paid AND contributor_email IS NOT NULL
       ORDER BY contributor_email, contributed_at
    ) c
   WHERE p_kind = 'thanks'
     AND NOT EXISTS (SELECT 1 FROM public.ulule_emails e
                      WHERE e.kind = 'thanks' AND e.recipient_email = c.contributor_email)
   LIMIT p_limit;
$fn$;

REVOKE EXECUTE ON FUNCTION public.ulule_next_recipients(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ulule_next_recipients(TEXT, INTEGER) TO service_role;

-- ── Tableau de bord ───────────────────────────────────────────────
-- En SQL plutôt qu'en JavaScript : l'API plafonne à 1000 lignes, et les
-- clics dépasseraient ce plafond sans rien signaler.

CREATE OR REPLACE FUNCTION public.get_ulule_dashboard()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
  SELECT jsonb_build_object(
    'ambassadors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'first_name', a.first_name, 'last_name', a.last_name,
        'email', a.email, 'slug', a.slug, 'unsubscribed', a.unsubscribed_at IS NOT NULL,
        'clicks', (SELECT count(*) FROM public.link_clicks l WHERE l.slug = a.slug),
        'contributions', (SELECT count(*) FROM public.contributions c WHERE c.ambassador_slug = a.slug AND c.is_paid),
        'amount_cents', (SELECT COALESCE(sum(c.amount_cents), 0) FROM public.contributions c WHERE c.ambassador_slug = a.slug AND c.is_paid),
        'email_status', e.status, 'sent_at', e.sent_at, 'opened_at', e.opened_at,
        'first_click_at', e.first_click_at, 'bounced_at', e.bounced_at
      ) ORDER BY a.first_name, a.last_name)
      FROM public.ambassadors a
      LEFT JOIN public.ulule_emails e ON e.kind = 'prelaunch' AND e.recipient_email = a.email
    ), '[]'::jsonb),
    'totals', (
      SELECT jsonb_build_object(
        'paid_count', count(*) FILTER (WHERE is_paid),
        'paid_cents', COALESCE(sum(amount_cents) FILTER (WHERE is_paid), 0),
        'unattributed_count', count(*) FILTER (WHERE is_paid AND ambassador_slug IS NULL),
        'other_count', count(*) FILTER (WHERE NOT is_paid)
      ) FROM public.contributions
    ),
    'email_counts', (
      SELECT jsonb_build_object(
        'prelaunch_failed', count(*) FILTER (WHERE kind = 'prelaunch' AND status = 'failed'),
        'thanks_sent',      count(*) FILTER (WHERE kind = 'thanks' AND status = 'sent'),
        'thanks_failed',    count(*) FILTER (WHERE kind = 'thanks' AND status = 'failed'),
        'stuck',            count(*) FILTER (WHERE status = 'pending' AND claimed_at < now() - interval '10 minutes')
      ) FROM public.ulule_emails
    ),
    'recent', COALESCE((
      SELECT jsonb_agg(r) FROM (
        SELECT c.contributor_name, c.contributor_email, c.amount_cents, c.status, c.is_paid,
               c.contributed_at, c.ambassador_slug, e.status AS thanks_status
          FROM public.contributions c
          LEFT JOIN public.ulule_emails e ON e.kind = 'thanks' AND e.recipient_email = c.contributor_email
         ORDER BY c.contributed_at DESC NULLS LAST
         LIMIT 50
      ) r
    ), '[]'::jsonb)
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_ulule_dashboard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ulule_dashboard() TO service_role;

-- ── Webhook Resend ────────────────────────────────────────────────
-- Même fonction, même webhook : aucun redéploiement. Un identifiant
-- inconnu de email_sends est cherché dans le journal de la campagne.

CREATE OR REPLACE FUNCTION public.record_email_event(
  p_provider_id TEXT,
  p_type        TEXT,
  p_at          TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
DECLARE v_touche INTEGER;
BEGIN
  UPDATE public.email_sends SET
    delivered_at   = CASE WHEN p_type = 'email.delivered'  THEN COALESCE(delivered_at, p_at)   ELSE delivered_at END,
    opened_at      = CASE WHEN p_type = 'email.opened'     THEN COALESCE(opened_at, p_at)      ELSE opened_at END,
    first_click_at = CASE WHEN p_type = 'email.clicked'    THEN COALESCE(first_click_at, p_at) ELSE first_click_at END,
    bounced_at     = CASE WHEN p_type = 'email.bounced'    THEN COALESCE(bounced_at, p_at)     ELSE bounced_at END,
    complained_at  = CASE WHEN p_type = 'email.complained' THEN COALESCE(complained_at, p_at)  ELSE complained_at END,
    open_count     = open_count  + CASE WHEN p_type = 'email.opened'  THEN 1 ELSE 0 END,
    click_count    = click_count + CASE WHEN p_type = 'email.clicked' THEN 1 ELSE 0 END,
    status         = CASE WHEN p_type = 'email.bounced' THEN 'failed' ELSE status END,
    error          = CASE WHEN p_type = 'email.bounced' THEN 'rebond' ELSE error END
  WHERE provider_id = p_provider_id;

  GET DIAGNOSTICS v_touche = ROW_COUNT;

  IF v_touche = 0 THEN
    UPDATE public.ulule_emails SET
      delivered_at   = CASE WHEN p_type = 'email.delivered'  THEN COALESCE(delivered_at, p_at)   ELSE delivered_at END,
      opened_at      = CASE WHEN p_type = 'email.opened'     THEN COALESCE(opened_at, p_at)      ELSE opened_at END,
      first_click_at = CASE WHEN p_type = 'email.clicked'    THEN COALESCE(first_click_at, p_at) ELSE first_click_at END,
      bounced_at     = CASE WHEN p_type = 'email.bounced'    THEN COALESCE(bounced_at, p_at)     ELSE bounced_at END,
      complained_at  = CASE WHEN p_type = 'email.complained' THEN COALESCE(complained_at, p_at)  ELSE complained_at END,
      open_count     = open_count  + CASE WHEN p_type = 'email.opened'  THEN 1 ELSE 0 END,
      click_count    = click_count + CASE WHEN p_type = 'email.clicked' THEN 1 ELSE 0 END
    WHERE provider_id = p_provider_id;
    GET DIAGNOSTICS v_touche = ROW_COUNT;
  END IF;

  RETURN v_touche > 0;
END;
$fn$;

-- ── Désinscription ────────────────────────────────────────────────
-- La page /desinscription existante sert aussi aux ambassadeurs.

CREATE OR REPLACE FUNCTION public.unsubscribe_by_token(p_token UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE v_id UUID;
BEGIN
  UPDATE public.email_preferences
     SET unsubscribed_at = COALESCE(unsubscribed_at, now())
   WHERE unsubscribe_token = p_token
  RETURNING user_id INTO v_id;

  IF v_id IS NULL THEN
    UPDATE public.ambassadors
       SET unsubscribed_at = COALESCE(unsubscribed_at, now())
     WHERE unsubscribe_token = p_token
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id IS NOT NULL;
END;
$$;
