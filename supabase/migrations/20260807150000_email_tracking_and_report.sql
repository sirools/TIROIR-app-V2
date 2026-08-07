-- ================================================================
-- 20260807150000_email_tracking_and_report.sql
-- Ce que devient un e-mail apres son depart, et le rapport pour /admin.
--
-- ── Tous les signaux ne se valent pas ─────────────────────────────
-- La REMISE est un fait serveur.
-- L'OUVERTURE est une inference reposant sur un pixel : Apple Mail
-- Privacy Protection precharge les images de tout le monde et declenche
-- donc des ouvertures qui n'ont pas eu lieu, tandis qu'un client qui
-- bloque les images n'en declenche aucune pour une lecture reelle.
-- Le CLIC est le seul signal d'interet qui ne mente pas.
-- La PLAINTE est le plus couteux : elle abime la reputation du domaine
-- pour tous les envois suivants, transactionnels compris.
--
-- Le suivi d'ouverture est une donnee de comportement au sens du RGPD.
-- D'ou email_open_tracking, qui permet de le couper sans redeployer.
-- ================================================================

ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS delivered_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_click_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS complained_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count    INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS email_sends_provider_idx
  ON public.email_sends (provider_id) WHERE provider_id IS NOT NULL;

COMMENT ON COLUMN public.email_sends.opened_at IS
  'Inference, pas un fait : Apple Mail precharge les images et ouvre a la place du lecteur.';
COMMENT ON COLUMN public.email_sends.complained_at IS
  'Plainte pour spam. Le signal le plus couteux : il abime la reputation du domaine.';

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS email_monthly_allowance INTEGER NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS email_cost_per_1000_usd NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_open_tracking     BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.app_settings.email_monthly_allowance IS
  'Enveloppe mensuelle du plan Resend. Gratuit : 3000/mois. Payant : 50000.';
COMMENT ON COLUMN public.app_settings.email_cost_per_1000_usd IS
  'Cout pour mille envois. 0 sur le plan gratuit ; 0,40 sur le plan a 20 $/50 000.';

-- ── Enregistrement d'un evenement Resend ──────────────────────────
-- Idempotente : Resend rejoue ses webhooks en cas d'echec, et un rejeu
-- ne doit pas gonfler les compteurs. Les horodatages ne retiennent que
-- la PREMIERE occurrence.

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
    -- Un rebond annule l'envoi : le message n'est jamais arrive.
    status         = CASE WHEN p_type = 'email.bounced' THEN 'failed' ELSE status END,
    error          = CASE WHEN p_type = 'email.bounced' THEN 'rebond' ELSE error END
  WHERE provider_id = p_provider_id;

  GET DIAGNOSTICS v_touche = ROW_COUNT;
  RETURN v_touche > 0;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.record_email_event(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_email_event(TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- ── Rapport de campagne ───────────────────────────────────────────
-- Reserve au service_role, comme get_admin_ai_spend et
-- admin_list_accounts : c'est la page /admin qui verifie is_admin avant
-- d'appeler. Un garde interne sur auth.uid() serait ici redondant ET
-- bloquant, puisque auth.uid() est nul en service_role.
--
-- « reste a servir » se calcule sur les MEMES criteres que la
-- reservation, sinon l'admin annoncerait un chiffre que le cron ne
-- confirmerait jamais.

DROP FUNCTION IF EXISTS public.get_lifecycle_email_status(TEXT);

CREATE OR REPLACE FUNCTION public.get_email_campaign_report(
  p_campaign TEXT DEFAULT 'presentation',
  p_limit    INTEGER DEFAULT 200
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $fn$
  SELECT jsonb_build_object(
    'campagne', p_campaign,

    'totaux', (SELECT jsonb_build_object(
        'envoyes',    count(*) FILTER (WHERE status = 'sent'),
        'delivres',   count(*) FILTER (WHERE delivered_at IS NOT NULL),
        'ouverts',    count(*) FILTER (WHERE opened_at IS NOT NULL),
        'cliques',    count(*) FILTER (WHERE first_click_at IS NOT NULL),
        'en_attente', count(*) FILTER (WHERE status = 'pending'),
        'echecs',     count(*) FILTER (WHERE status = 'failed'),
        'plaintes',   count(*) FILTER (WHERE complained_at IS NOT NULL))
      FROM public.email_sends WHERE campaign = p_campaign),

    'desinscrits', (SELECT count(*) FROM public.email_preferences WHERE unsubscribed_at IS NOT NULL),

    'reste', (SELECT jsonb_build_object(
        'regime_j3',  count(*) FILTER (WHERE u.created_at >  now() - INTERVAL '30 days'),
        'rattrapage', count(*) FILTER (WHERE u.created_at <= now() - INTERVAL '30 days'),
        'total',      count(*))
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
      LEFT JOIN public.email_preferences ep ON ep.user_id = u.id
     WHERE u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL
       AND u.banned_until IS NULL AND COALESCE(u.is_anonymous, FALSE) = FALSE
       AND ep.unsubscribed_at IS NULL
       AND u.created_at <= now() - INTERVAL '3 days'
       AND NOT EXISTS (SELECT 1 FROM public.email_sends es
                        WHERE es.user_id = u.id AND es.campaign = p_campaign)),

    'enveloppe', (SELECT jsonb_build_object(
        'envoyes_ce_mois', (SELECT count(*) FROM public.email_sends
                             WHERE status = 'sent' AND sent_at >= date_trunc('month', now())),
        'plafond_mensuel', a.email_monthly_allowance,
        'cout_pour_mille', a.email_cost_per_1000_usd,
        'suivi_ouverture', a.email_open_tracking,
        'actif',           a.email_lifecycle_enabled,
        'rattrapage',      a.email_backfill_enabled,
        'lot',             a.email_batch_size,
        'adresse',         NULLIF(btrim(a.email_postal_address), ''))
      FROM public.app_settings a WHERE a.id = 1),

    'destinataires', COALESCE((SELECT jsonb_agg(t.d) FROM (
        SELECT jsonb_build_object(
          'email',      u.email,
          'statut',     es.status,
          'motif',      es.reason,
          'sent_at',    es.sent_at,
          'delivre',    es.delivered_at IS NOT NULL,
          'ouvert',     es.opened_at IS NOT NULL,
          'clics',      es.click_count,
          'plainte',    es.complained_at IS NOT NULL,
          'desinscrit', ep.unsubscribed_at IS NOT NULL,
          'erreur',     es.error
        ) AS d
          FROM public.email_sends es
          JOIN auth.users u ON u.id = es.user_id
          LEFT JOIN public.email_preferences ep ON ep.user_id = es.user_id
         WHERE es.campaign = p_campaign
         ORDER BY es.sent_at DESC NULLS FIRST, es.claimed_at DESC
         LIMIT p_limit
    ) t), '[]'::jsonb)
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_email_campaign_report(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_campaign_report(TEXT, INTEGER) TO service_role;
