-- ================================================================
-- 20261127090000_messagerie.sql
-- Messagerie privée de Tiroir.
--
-- Phase 1 : depuis une vente de la salle des ventes (/ventes/<jeton>),
-- toute personne — avec ou sans compte — écrit en privé au vendeur.
-- Phase 2 : conversations directes entre membres, sur les mêmes tables
-- (kind = 'direct', auction_id nul). Rien d'autre à créer.
--
--   threads              un fil : lié à une vente ('annonce') ou direct
--   thread_participants  qui y parle : un compte, ou un invité (prénom,
--                        adresse, adresse vérifiée ou non)
--   thread_messages      les messages, corps CHIFFRÉ par le site
--                        (AES-256-GCM, web/lib/messagingCrypto.ts) : la
--                        base ne contient jamais le texte en clair
--
-- Les noms « conversations » et « messages » sont déjà ceux de
-- l'assistant (20260622214252_conversations.sql) : d'où « threads ».
--
-- Unicité : threads.dedupe_key. Un seul fil par couple vente + acheteur
-- ('annonce:<vente>:u:<compte>' ou 'annonce:<vente>:e:<adresse>') ; en
-- phase 2, un seul fil par paire de membres ('direct:<a>:<b>', triés).
-- Un deuxième message du même acheteur rouvre le fil existant.
--
-- Accès : aucune politique RLS, comme les enchères. Rien n'est lisible
-- ni inscriptible avec la clé publique ; tout passe par les routes du
-- site (web/pages/api/messages, web/lib/messagingServer.ts), qui
-- vérifient la session ou le lien signé de l'invité avant d'utiliser la
-- clé service. Les adresses des invités ne quittent jamais le serveur.
--
-- Additive : aucune table existante n'est modifiée.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.threads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT        NOT NULL CHECK (kind IN ('annonce', 'direct')),
  auction_id      UUID        NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  dedupe_key      TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reported_at     TIMESTAMPTZ NULL,
  CONSTRAINT threads_dedupe_key_key UNIQUE (dedupe_key),
  CONSTRAINT threads_kind_auction CHECK (
    (kind = 'annonce' AND auction_id IS NOT NULL) OR (kind = 'direct' AND auction_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.thread_participants (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id         UUID        NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  role              TEXT        NOT NULL CHECK (role IN ('seller', 'buyer', 'member')),
  user_id           UUID        NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_name        TEXT        NULL CHECK (guest_name IS NULL OR char_length(guest_name) BETWEEN 1 AND 60),
  guest_email       TEXT        NULL CHECK (guest_email IS NULL OR char_length(guest_email) <= 254),
  guest_verified_at TIMESTAMPTZ NULL,
  locale            TEXT        NULL CHECK (locale IS NULL OR locale ~ '^[a-z]{2}$'),
  last_read_at      TIMESTAMPTZ NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un compte, ou un invité avec prénom et adresse : jamais les deux.
  CONSTRAINT thread_participants_identity CHECK (
    (user_id IS NOT NULL AND guest_email IS NULL AND guest_name IS NULL)
    OR (user_id IS NULL AND guest_email IS NOT NULL AND guest_name IS NOT NULL)
  ),
  CONSTRAINT thread_participants_thread_user_key UNIQUE (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.thread_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id    UUID        NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  author_id    UUID        NOT NULL REFERENCES public.thread_participants(id) ON DELETE CASCADE,
  -- Chiffré : « v1.<iv>.<sceau>.<texte> ». 2000 caractères en clair au plus.
  body         TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 12000),
  -- Nul tant que l'invité n'a pas confirmé son adresse : le message n'est
  -- alors montré ni envoyé à personne.
  delivered_at TIMESTAMPTZ NULL,
  -- Empreinte de l'adresse IP (jamais l'adresse) : limitation de débit.
  ip_hash      TEXT        NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS threads_auction_idx             ON public.threads (auction_id);
CREATE INDEX IF NOT EXISTS thread_participants_user_idx    ON public.thread_participants (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS thread_participants_email_idx   ON public.thread_participants (guest_email) WHERE guest_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS thread_participants_thread_idx  ON public.thread_participants (thread_id);
CREATE INDEX IF NOT EXISTS thread_messages_thread_idx      ON public.thread_messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS thread_messages_author_idx      ON public.thread_messages (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS thread_messages_ip_idx          ON public.thread_messages (ip_hash, created_at DESC) WHERE ip_hash IS NOT NULL;

ALTER TABLE public.threads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.threads, public.thread_participants, public.thread_messages FROM anon, authenticated;

COMMENT ON TABLE public.threads IS
  'Fils de la messagerie privee. Sans politique RLS : lecture et ecriture par les routes du site seulement (cle service).';
COMMENT ON COLUMN public.threads.dedupe_key IS
  'Unicite : un fil par vente et acheteur (annonce:<vente>:u:<compte> ou :e:<adresse>), un fil par paire de membres (direct:<a>:<b>).';
COMMENT ON COLUMN public.thread_participants.guest_email IS
  'Adresse d un invite sans compte. Jamais envoyee a l autre partie ni au navigateur.';
COMMENT ON COLUMN public.thread_messages.body IS
  'Corps chiffre par le site (AES-256-GCM). Jamais de texte en clair en base.';
