-- ================================================================
-- 20260807140000_lifecycle_email_cron.sql
-- Le secret partage, l'envoi cible, et la tache planifiee.
--
-- ── Le secret ne transite nulle part ──────────────────────────────
-- Genere DANS la base et range dans le Vault. Il n'est ni dans une
-- variable d'environnement, ni dans la commande du cron, ni dans un
-- journal de deploiement : la fonction edge presente ce qu'elle a reçu,
-- la base repond oui ou non. La rotation consiste a rejouer
-- create_secret, sans rien redeployer.
--
-- Pourquoi un secret plutot que la verification JWT : une cle anon est
-- un JWT parfaitement valide. `verify_jwt` laisserait donc n'importe qui
-- declencher une fonction qui expedie du courrier.
--
-- ── p_only_user ───────────────────────────────────────────────────
-- Expedier un exemplaire a un compte precis avant d'ouvrir la campagne.
-- Le rendu dans un vrai client mail est la seule verification qu'aucun
-- apercu navigateur ne remplace. Le compte ainsi servi est journalise
-- comme les autres : l'unicite l'exclut ensuite du reste.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'lifecycle_cron') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'lifecycle_cron',
      'Secret partage pg_cron <-> send-lifecycle-emails'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cron_secret_matches(p_secret TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'vault'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
     WHERE name = 'lifecycle_cron'
       AND decrypted_secret = p_secret
       AND length(coalesce(p_secret, '')) > 0
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.cron_secret_matches(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_secret_matches(TEXT) TO service_role;

-- ── Reservation, avec ciblage optionnel ───────────────────────────

CREATE OR REPLACE FUNCTION public.claim_lifecycle_recipients(
  p_campaign  TEXT,
  p_limit     INTEGER DEFAULT NULL,
  p_only_user UUID DEFAULT NULL
)
RETURNS TABLE(
  user_id           UUID,
  email             TEXT,
  display_name      TEXT,
  reason            TEXT,
  unsubscribe_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $fn$
#variable_conflict use_column
DECLARE
  v_enabled  BOOLEAN;
  v_backfill BOOLEAN;
  v_limit    INTEGER;
  v_adresse  TEXT;
BEGIN
  SELECT email_lifecycle_enabled, email_backfill_enabled,
         COALESCE(p_limit, email_batch_size), btrim(email_postal_address)
    INTO v_enabled, v_backfill, v_limit, v_adresse
    FROM public.app_settings WHERE id = 1;

  IF NOT COALESCE(v_enabled, FALSE) THEN RETURN; END IF;

  IF v_adresse IS NULL OR v_adresse = '' THEN
    RAISE EXCEPTION 'EMAIL_POSTAL_ADDRESS_MISSING: renseigner app_settings.email_postal_address avant tout envoi';
  END IF;

  -- Instruction SEPAREE : une ligne inseree par une CTE n'est pas
  -- visible au reste de la meme instruction. Fusionnee plus bas, la
  -- jointure ne trouverait rien pour les comptes sans preference, qui
  -- seraient reserves sans jamais etre servis.
  INSERT INTO public.email_preferences (user_id)
  SELECT u.id
    FROM auth.users u
   WHERE u.email IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.email_preferences ep WHERE ep.user_id = u.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  WITH eligibles AS (
    SELECT u.id,
           u.email::TEXT AS mail,
           COALESCE(p.display_name, '')::TEXT AS nom,
           CASE WHEN u.created_at < now() - INTERVAL '30 days' THEN 'backfill' ELSE 'j3' END AS motif
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
      JOIN public.email_preferences ep ON ep.user_id = u.id
     WHERE u.email IS NOT NULL
       AND u.email_confirmed_at IS NOT NULL
       AND u.banned_until IS NULL
       AND COALESCE(u.is_anonymous, FALSE) = FALSE
       AND ep.unsubscribed_at IS NULL
       AND u.created_at <= now() - INTERVAL '3 days'
       AND (p_only_user IS NULL OR u.id = p_only_user)
       -- Un envoi cible ignore le decoupage regime/rattrapage : il sert
       -- a controler un rendu, pas a respecter un rythme de campagne.
       AND (p_only_user IS NOT NULL OR v_backfill OR u.created_at > now() - INTERVAL '30 days')
       AND NOT EXISTS (
         SELECT 1 FROM public.email_sends es
          WHERE es.user_id = u.id AND es.campaign = p_campaign
       )
     ORDER BY u.created_at DESC
     LIMIT CASE WHEN p_only_user IS NOT NULL THEN 1 ELSE v_limit END
  ),
  reserves AS (
    INSERT INTO public.email_sends (user_id, campaign, reason)
    SELECT e.id, p_campaign, e.motif FROM eligibles e
    ON CONFLICT (user_id, campaign) DO NOTHING
    RETURNING email_sends.user_id AS uid, email_sends.reason AS motif
  )
  SELECT r.uid, e.mail, e.nom, r.motif, ep.unsubscribe_token
    FROM reserves r
    JOIN eligibles e ON e.id = r.uid
    JOIN public.email_preferences ep ON ep.user_id = r.uid;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.claim_lifecycle_recipients(TEXT, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.claim_lifecycle_recipients(TEXT, INTEGER);

-- ── La tache ──────────────────────────────────────────────────────
-- Minute 17 et non zero : le haut de l'heure est l'instant ou tout le
-- monde declenche ses taches, et ou les fournisseurs de messagerie
-- filtrent le plus.
--
-- Arret d'urgence, sans redeploiement ni suppression de tache :
--   UPDATE public.app_settings SET email_lifecycle_enabled = FALSE WHERE id = 1;

SELECT cron.schedule(
  'lifecycle-presentation',
  '17 * * * *',
  $$
  select net.http_post(
    url     := 'https://jsduaelevpwflvwhhhvx.supabase.co/functions/v1/send-lifecycle-emails',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lifecycle_cron')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
