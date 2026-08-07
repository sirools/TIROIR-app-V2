-- ================================================================
-- 20260807130000_lifecycle_emails.sql
-- Envoi automatique du message de presentation a J+3 de l'inscription.
--
-- Trois obligations, dont deux ne sont pas negociables.
--
-- 1. DESINSCRIPTION. Aucune infrastructure n'existait : profiles n'avait
--    aucune preference e-mail. Un envoi automatise sans desinscription
--    fonctionnelle est une infraction (RGPD, ePrivacy, LCEN), pas un
--    detail de confort. Le jeton est un UUID aleatoire propre a chaque
--    compte : il tient dans une URL, ne revele pas l'identifiant du
--    compte, et se revoque en le regenerant.
--
-- 2. UNE SEULE FOIS. La contrainte UNIQUE(user_id, campaign) est la
--    garantie, pas une convention de code. Deux executions simultanees
--    du cron, un rejeu apres incident, un rattrapage lance en double :
--    aucun de ces cas ne peut produire un second envoi.
--
-- 3. RESERVER AVANT D'ENVOYER. La fonction ne rend pas une liste de
--    destinataires, elle INSERE d'abord la ligne de journal en statut
--    'pending' et ne rend que ce qu'elle a reussi a inserer. Rendre la
--    liste puis journaliser apres coup ouvre une fenetre pendant
--    laquelle un second appel selectionne les memes personnes.
--
-- Le rattrapage des comptes deja inscrits et le regime de croisiere a
-- J+3 partagent la MEME campagne. C'est volontaire : un compte cree il y
-- a deux jours sera rattrape par le regime normal, un compte ancien par
-- le rattrapage, et l'unicite empeche qu'il reçoive les deux.
-- ================================================================

-- ── Preferences ───────────────────────────────────────────────────
-- Table separee de profiles : elle porte un jeton secret, et une
-- desinscription doit survivre a tout ce qu'on fera un jour subir au
-- profil. Pas de politique RLS permissive : personne n'y accede depuis
-- le client, tout passe par des fonctions SECURITY DEFINER.

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  unsubscribed_at   TIMESTAMPTZ,
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_preferences IS
  'Consentement e-mail marketing. Absence de ligne = jamais sollicite, donc envoyable.';
COMMENT ON COLUMN public.email_preferences.unsubscribe_token IS
  'Secret porte par l''URL de desinscription. Ne revele pas l''identifiant du compte.';

-- ── Journal des envois ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_sends (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign    TEXT NOT NULL,
  reason      TEXT NOT NULL DEFAULT 'j3',
  status      TEXT NOT NULL DEFAULT 'pending',
  provider_id TEXT,
  error       TEXT,
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at     TIMESTAMPTZ,
  CONSTRAINT email_sends_status_chk CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  CONSTRAINT email_sends_reason_chk CHECK (reason IN ('j3', 'backfill')),
  CONSTRAINT email_sends_once UNIQUE (user_id, campaign)
);

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS email_sends_campaign_status_idx
  ON public.email_sends (campaign, status);

COMMENT ON CONSTRAINT email_sends_once ON public.email_sends IS
  'La garantie « une seule fois », au niveau de la base et non du code appelant.';

-- ── Reglages ──────────────────────────────────────────────────────
-- L'adresse postale est vide par defaut, ET la reservation refuse de
-- rendre quoi que ce soit tant qu'elle l'est. Un envoi commercial doit
-- identifier son expediteur ; mieux vaut un cron qui ne part pas qu'un
-- envoi non conforme.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS email_lifecycle_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_backfill_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_batch_size        INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS email_postal_address    TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.app_settings.email_postal_address IS
  'Identification legale de l''expediteur, portee par le pied de page. Vide = aucun envoi.';
COMMENT ON COLUMN public.app_settings.email_backfill_enabled IS
  'Rattrapage des comptes anterieurs. Se coupe seul une fois la campagne epuisee.';

-- ── Reservation des destinataires ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_lifecycle_recipients(
  p_campaign TEXT,
  p_limit    INTEGER DEFAULT NULL
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
AS $$
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

  -- Garde-fou legal, place ici et non dans la fonction edge : c'est le
  -- seul endroit que TOUS les chemins d'envoi traversent.
  IF v_adresse IS NULL OR v_adresse = '' THEN
    RAISE EXCEPTION 'EMAIL_POSTAL_ADDRESS_MISSING: renseigner app_settings.email_postal_address avant tout envoi';
  END IF;

  -- Etape 1, en instruction SEPAREE : garantir un jeton de
  -- desinscription a tout compte eligible.
  --
  -- Le faire dans une CTE de la requete suivante ne marcherait PAS : une
  -- ligne inseree par une CTE n'est pas visible aux autres parties de la
  -- meme instruction, qui travaillent toutes sur l'instantane pris a son
  -- debut. La jointure finale ne trouverait rien pour les comptes sans
  -- preference, et ces comptes seraient reserves sans jamais etre
  -- servis — donc silencieusement prives du message, pour toujours.
  INSERT INTO public.email_preferences (user_id)
  SELECT u.id
    FROM auth.users u
   WHERE u.email IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.email_preferences ep WHERE ep.user_id = u.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Etape 2 : reserver, puis rendre ce qui a effectivement ete reserve.
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
       AND u.email_confirmed_at IS NOT NULL   -- jamais d'adresse non confirmee : rebond garanti
       AND u.banned_until IS NULL
       AND COALESCE(u.is_anonymous, FALSE) = FALSE
       AND ep.unsubscribed_at IS NULL
       AND u.created_at <= now() - INTERVAL '3 days'
       AND (
         v_backfill                                    -- rattrapage : tout le monde
         OR u.created_at > now() - INTERVAL '30 days'  -- regime normal : les inscriptions recentes
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.email_sends es
          WHERE es.user_id = u.id AND es.campaign = p_campaign
       )
     ORDER BY u.created_at DESC
     LIMIT v_limit
  ),
  reserves AS (
    -- ON CONFLICT DO NOTHING : deux executions concurrentes se disputent
    -- les memes lignes, une seule les obtient. C'est l'unicite qui
    -- arbitre, pas un verrou applicatif.
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
$$;

REVOKE EXECUTE ON FUNCTION public.claim_lifecycle_recipients(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- ── Cloture d'un envoi ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_lifecycle_send(
  p_user_id     UUID,
  p_campaign    TEXT,
  p_status      TEXT,
  p_provider_id TEXT DEFAULT NULL,
  p_error       TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
  UPDATE public.email_sends
     SET status      = p_status,
         provider_id = p_provider_id,
         error       = left(p_error, 500),
         sent_at     = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END
   WHERE user_id = p_user_id AND campaign = p_campaign;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_lifecycle_send(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ── Desinscription ────────────────────────────────────────────────
-- Prend le jeton et rien d'autre : la page web appelle cette fonction
-- sans etre authentifiee, puisque personne ne se connecte pour se
-- desabonner. Rend TRUE meme si le compte etait deja desinscrit — un
-- second clic ne doit pas afficher d'erreur.

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

  RETURN v_id IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unsubscribe_by_token(UUID) FROM PUBLIC, anon, authenticated;

-- ── Etat de campagne, pour l'admin ────────────────────────────────

-- SECURITY DEFINER lit auth.users : sans garde, n'importe quel compte
-- authentifie apprendrait combien de personnes sont inscrites et
-- combien se sont desabonnees.

CREATE OR REPLACE FUNCTION public.get_lifecycle_email_status(p_campaign TEXT DEFAULT 'presentation')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'FORBIDDEN: reserve a l''administration';
  END IF;

  RETURN (
  SELECT jsonb_build_object(
    'campagne',      p_campaign,
    'envoyes',       (SELECT count(*) FROM public.email_sends WHERE campaign = p_campaign AND status = 'sent'),
    'en_attente',    (SELECT count(*) FROM public.email_sends WHERE campaign = p_campaign AND status = 'pending'),
    'echecs',        (SELECT count(*) FROM public.email_sends WHERE campaign = p_campaign AND status = 'failed'),
    'desinscrits',   (SELECT count(*) FROM public.email_preferences WHERE unsubscribed_at IS NOT NULL),
    'restants',      (SELECT count(*) FROM auth.users u
                       LEFT JOIN public.email_preferences ep ON ep.user_id = u.id
                      WHERE u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL
                        AND u.banned_until IS NULL AND COALESCE(u.is_anonymous, FALSE) = FALSE
                        AND ep.unsubscribed_at IS NULL
                        AND u.created_at <= now() - INTERVAL '3 days'
                        AND NOT EXISTS (SELECT 1 FROM public.email_sends es
                                         WHERE es.user_id = u.id AND es.campaign = p_campaign)),
    'reglages',      (SELECT jsonb_build_object(
                        'actif',            email_lifecycle_enabled,
                        'rattrapage',       email_backfill_enabled,
                        'lot',              email_batch_size,
                        'adresse_postale',  NULLIF(btrim(email_postal_address), ''))
                      FROM public.app_settings WHERE id = 1)
  ));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_lifecycle_email_status(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lifecycle_email_status(TEXT) TO authenticated;
