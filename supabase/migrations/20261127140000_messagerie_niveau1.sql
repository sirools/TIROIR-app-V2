-- ================================================================
-- 20261127140000_messagerie_niveau1.sql
-- Messagerie privée, durcissement « niveau 1 » (décidé le 27/11/2026) :
--
--   · adresse des invités chiffrée par le site, avec une empreinte
--     (guest_email_hash) pour retrouver un invité sans la lire ;
--   · liens d'invité révocables (guest_link_epoch : un lien porte
--     l'époque à laquelle il a été émis ; l'augmenter bloque les anciens) ;
--   · « Supprimer la conversation » par participant (cleared_at) ;
--   · conservation : un fil est supprimé 12 mois après son dernier
--     message, un message jamais confirmé au bout de 30 jours ;
--   · pseudo dédié (profiles.pseudo), unique, montré dans la messagerie
--     à la place du nom du profil.
--
-- Additive et compatible avec le code déjà déployé : elle peut être
-- appliquée avant la mise en ligne du code qui s'en sert (la vente ne
-- propose « Contacter le vendeur » qu'une fois ces colonnes présentes).
-- ================================================================

-- ── Participants ───────────────────────────────────────────────────
ALTER TABLE public.thread_participants
  ADD COLUMN IF NOT EXISTS guest_email_hash TEXT        NULL,
  ADD COLUMN IF NOT EXISTS guest_link_epoch INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleared_at       TIMESTAMPTZ NULL;

-- Chiffrée, l'adresse dépasse 254 caractères.
ALTER TABLE public.thread_participants DROP CONSTRAINT IF EXISTS thread_participants_guest_email_check;
ALTER TABLE public.thread_participants DROP CONSTRAINT IF EXISTS thread_participants_guest_email_length;
ALTER TABLE public.thread_participants
  ADD CONSTRAINT thread_participants_guest_email_length
  CHECK (guest_email IS NULL OR char_length(guest_email) <= 1000);

ALTER TABLE public.thread_participants DROP CONSTRAINT IF EXISTS thread_participants_link_epoch_positive;
ALTER TABLE public.thread_participants
  ADD CONSTRAINT thread_participants_link_epoch_positive CHECK (guest_link_epoch >= 0);

CREATE INDEX IF NOT EXISTS thread_participants_email_hash_idx
  ON public.thread_participants (guest_email_hash) WHERE guest_email_hash IS NOT NULL;

COMMENT ON COLUMN public.thread_participants.guest_email IS
  'Adresse d un invite, CHIFFREE par le site (web/lib/messagingCrypto.ts). Jamais envoyee a l autre partie ni au navigateur.';
COMMENT ON COLUMN public.thread_participants.guest_email_hash IS
  'Empreinte HMAC de l adresse : retrouver un invite (unicite, debit) sans dechiffrer.';
COMMENT ON COLUMN public.thread_participants.guest_name IS
  'Pseudo choisi par l invite.';
COMMENT ON COLUMN public.thread_participants.guest_link_epoch IS
  'Epoque des liens de l invite. L augmenter bloque tous les liens deja envoyes.';
COMMENT ON COLUMN public.thread_participants.cleared_at IS
  'Ce participant a supprime la conversation a cette date : les messages anterieurs ne lui sont plus montres.';

-- ── Pseudo ─────────────────────────────────────────────────────────
-- Pas de droit UPDATE pour authenticated : le pseudo s'écrit par la route
-- du site (web/pages/api/profile/pseudo.ts), qui contrôle format et unicité.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pseudo     TEXT NULL;
-- Forme comparable du pseudo (minuscules Unicode, calculées par le site) :
-- lower() de Postgres dépend de la langue du serveur et laisserait passer
-- « LÉA » à côté de « léa » sous une collation C.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pseudo_key TEXT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pseudo_format;
-- Garde-fou large, indépendant de la langue du serveur (une classe comme
-- [[:alnum:]] refuserait « é » sous une collation C) : la règle exacte —
-- lettres, chiffres, point, tiret, tiret bas — est celle du site
-- (web/lib/messaging.ts, PSEUDO_PATTERN).
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pseudo_format
  CHECK (pseudo IS NULL OR pseudo ~ '^[^[:space:]@<>/:]{3,24}$');
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pseudo_key_set;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pseudo_key_set CHECK ((pseudo IS NULL) = (pseudo_key IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pseudo_key_unique
  ON public.profiles (pseudo_key) WHERE pseudo_key IS NOT NULL;
COMMENT ON COLUMN public.profiles.pseudo IS
  'Pseudo montre dans la messagerie privee. Unique sans tenir compte de la casse (pseudo_key).';
COMMENT ON COLUMN public.profiles.pseudo_key IS
  'Pseudo en minuscules Unicode, calcule par le site (web/lib/messaging.ts, pseudoKey). Porte l unicite.';

-- ── Conservation ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_expired_threads()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  n_old     INTEGER;
  n_pending INTEGER;
  n_msgs    INTEGER;
BEGIN
  -- 12 mois après le dernier message.
  DELETE FROM public.threads WHERE last_message_at < now() - interval '12 months';
  GET DIAGNOSTICS n_old = ROW_COUNT;
  -- Fil dont rien n'a jamais été remis (invité qui n'a pas confirmé) : 30 jours.
  DELETE FROM public.threads t
   WHERE t.created_at < now() - interval '30 days'
     AND NOT EXISTS (SELECT 1 FROM public.thread_messages m WHERE m.thread_id = t.id AND m.delivered_at IS NOT NULL);
  GET DIAGNOSTICS n_pending = ROW_COUNT;
  -- Message jamais confirmé dans un fil par ailleurs actif : 30 jours.
  DELETE FROM public.thread_messages WHERE delivered_at IS NULL AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS n_msgs = ROW_COUNT;
  RETURN n_old + n_pending + n_msgs;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_threads() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_threads() TO service_role;

-- Chaque nuit à 3 h 43 (UTC). Sans pg_cron (base locale), la fonction
-- reste appelable à la main.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('messagerie-conservation', '43 3 * * *', 'select public.purge_expired_threads()');
  END IF;
END $$;
