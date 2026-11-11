-- ================================================================
-- 20261112090000_ulule_lancement_noel.sql
-- Campagne Ulule, lancement du 24 novembre 2026 (« Noël avant Noël ») :
--   - liens sans e-mail (proches prévenus par SMS, bannière, Instagram) ;
--   - quatre e-mails de plus : lancement, relance, dernières 48 h, bilan ;
--   - paliers de la jauge, réglables depuis l'admin.
-- Additive : aucune donnée existante n'est modifiée, sauf la date de
-- lancement si elle est encore celle d'origine (12 janvier 2027).
-- ================================================================

-- ── Liens sans e-mail ─────────────────────────────────────────────
-- Un lien perso, compté dans le tableau de bord, mais jamais d'e-mail.
-- UNIQUE laisse passer plusieurs NULL.
ALTER TABLE public.ambassadors ALTER COLUMN email DROP NOT NULL;

INSERT INTO public.ambassadors (first_name, last_name, email, slug) VALUES
  ('Site', 'bannière de l’accueil', NULL, 'accueil'),
  ('Instagram', 'lien de la bio', NULL, 'instagram')
ON CONFLICT (slug) DO NOTHING;

-- ── Paliers et date ───────────────────────────────────────────────
ALTER TABLE public.ulule_campaign
  ADD COLUMN milestones_cents INTEGER[] NOT NULL DEFAULT ARRAY[100000, 200000, 500000];

UPDATE public.ulule_campaign
   SET launch_at = '2026-11-24 08:00:00+01'
 WHERE id = 1 AND launch_at = '2027-01-12 08:00:00+01';
ALTER TABLE public.ulule_campaign ALTER COLUMN launch_at SET DEFAULT '2026-11-24 08:00:00+01';

-- ── Six e-mails ───────────────────────────────────────────────────
ALTER TABLE public.ulule_emails DROP CONSTRAINT IF EXISTS ulule_emails_kind_check;
ALTER TABLE public.ulule_emails ADD CONSTRAINT ulule_emails_kind_check
  CHECK (kind IN ('prelaunch', 'launch', 'reminder', 'last48h', 'recap', 'thanks'));

-- Qui reste à servir, par e-mail :
--   prelaunch, launch, reminder, last48h : ambassadeurs avec adresse, inscrits ;
--   thanks : contributeurs payés ;
--   recap  : les deux, une fois par adresse (l'ambassadeur d'abord : il a
--            un jeton de désinscription).
-- Une personne qui a déjà une ligne au journal pour cet e-mail, quel qu'en
-- soit l'état, n'est pas reprise.
DROP FUNCTION IF EXISTS public.ulule_next_recipients(TEXT, INTEGER);
CREATE FUNCTION public.ulule_next_recipients(p_kind TEXT, p_limit INTEGER)
RETURNS TABLE (email TEXT, name TEXT, ambassador_id UUID, slug TEXT, unsubscribe_token UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
  WITH amb AS (
    SELECT a.email, a.first_name AS name, a.id AS ambassador_id, a.slug, a.unsubscribe_token
      FROM public.ambassadors a
     WHERE a.email IS NOT NULL AND a.unsubscribed_at IS NULL
  ),
  contrib AS (
    SELECT DISTINCT ON (contributor_email)
           contributor_email AS email, contributor_name AS name,
           NULL::uuid AS ambassador_id, NULL::text AS slug, NULL::uuid AS unsubscribe_token
      FROM public.contributions
     WHERE is_paid AND contributor_email IS NOT NULL
     ORDER BY contributor_email, contributed_at
  ),
  audience AS (
    SELECT * FROM amb WHERE p_kind IN ('prelaunch', 'launch', 'reminder', 'last48h', 'recap')
    UNION ALL
    SELECT * FROM contrib c
     WHERE p_kind = 'thanks'
        OR (p_kind = 'recap' AND NOT EXISTS (SELECT 1 FROM amb WHERE amb.email = c.email))
  )
  SELECT au.* FROM audience au
   WHERE NOT EXISTS (SELECT 1 FROM public.ulule_emails e
                      WHERE e.kind = p_kind AND e.recipient_email = au.email)
   LIMIT p_limit;
$fn$;

REVOKE EXECUTE ON FUNCTION public.ulule_next_recipients(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ulule_next_recipients(TEXT, INTEGER) TO service_role;

-- ── Tableau de bord ───────────────────────────────────────────────
-- Ajoute, par e-mail : envoyés, échecs, restant à envoyer.
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
      ) ORDER BY a.email IS NULL, a.first_name, a.last_name)
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
    'by_kind', (
      SELECT jsonb_object_agg(k, jsonb_build_object(
        'sent',   (SELECT count(*) FROM public.ulule_emails e WHERE e.kind = k AND e.status = 'sent'),
        'failed', (SELECT count(*) FROM public.ulule_emails e WHERE e.kind = k AND e.status = 'failed'),
        'to_send', (SELECT count(*) FROM public.ulule_next_recipients(k, 100000))
      ))
      FROM unnest(ARRAY['prelaunch', 'launch', 'reminder', 'last48h', 'recap', 'thanks']) AS k
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
