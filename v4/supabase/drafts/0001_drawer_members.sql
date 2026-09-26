-- ================================================================
-- BROUILLON V4.0 — À TESTER EN PREPROD, NE PAS APPLIQUER EN PROD
-- 0001_drawer_members.sql
-- Tiroirs partagés, étape 1 : le trousseau (membres), la serrure,
-- les invitations, et une porte d'entrée dédiée en lecture.
--
-- Purement additif (v4/docs/migration-tiroirs-partages.md) :
--   · aucune policy existante n'est modifiée — drawers, collections,
--     objects et le stockage restent visibles de leur seul propriétaire ;
--   · tout accès partagé passe par les fonctions de ce fichier, que seuls
--     les futurs écrans « Tiroirs partagés » appelleront. L'app et le site
--     actuels, y compris les versions déjà installées, ne voient rien de
--     nouveau.
--
-- Les règles de la serrure (drawer_can) reprennent exactement celles de
-- v4/domain/serrure.ts ; les deux doivent rester alignées.
-- ================================================================

-- ── Serrure du Tiroir ─────────────────────────────────────────────
-- ferme      : seul le propriétaire entre, même si des clés existent
-- entrouvert : les membres entrent, selon leur rôle
-- ouvert     : tout compte peut voir ; seules les clés permettent d'agir

ALTER TABLE public.drawers
  ADD COLUMN IF NOT EXISTS serrure TEXT NOT NULL DEFAULT 'ferme'
    CHECK (serrure IN ('ferme', 'entrouvert', 'ouvert'));

-- ── drawer_members : le trousseau ─────────────────────────────────
-- Une ligne = une clé : une personne, un Tiroir, un rôle, et une date
-- d'expiration quand la clé est confiée temporairement.

CREATE TABLE IF NOT EXISTS public.drawer_members (
  drawer_id  UUID        NOT NULL REFERENCES public.drawers(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by UUID                 REFERENCES auth.users(id)     ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (drawer_id, user_id),
  -- La clé du propriétaire n'expire jamais.
  CONSTRAINT drawer_members_owner_no_expiry CHECK (role <> 'owner' OR expires_at IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS drawer_members_one_owner_idx
  ON public.drawer_members (drawer_id) WHERE role = 'owner';
CREATE INDEX IF NOT EXISTS drawer_members_user_id_idx    ON public.drawer_members (user_id);
CREATE INDEX IF NOT EXISTS drawer_members_invited_by_idx ON public.drawer_members (invited_by);

DROP TRIGGER IF EXISTS set_drawer_members_updated_at ON public.drawer_members;
CREATE TRIGGER set_drawer_members_updated_at
  BEFORE UPDATE ON public.drawer_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.drawer_members ENABLE ROW LEVEL SECURITY;

-- Chacun voit ses propres clés ; les autres passent par list_drawer_members.
DROP POLICY IF EXISTS "drawer_members: select own" ON public.drawer_members;
CREATE POLICY "drawer_members: select own"
  ON public.drawer_members FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- Chaque Tiroir existant reçoit la clé de son propriétaire…
INSERT INTO public.drawer_members (drawer_id, user_id, role)
SELECT id, user_id, 'owner' FROM public.drawers
ON CONFLICT (drawer_id, user_id) DO NOTHING;

-- …et chaque nouveau Tiroir aussi (couvre handle_new_user sans le modifier).
CREATE OR REPLACE FUNCTION public.add_drawer_owner_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.drawer_members (drawer_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT (drawer_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_drawer_owner_member() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_drawer_created_add_owner ON public.drawers;
CREATE TRIGGER on_drawer_created_add_owner
  AFTER INSERT ON public.drawers
  FOR EACH ROW EXECUTE FUNCTION public.add_drawer_owner_member();

-- ── drawer_invites : confier une clé ──────────────────────────────
-- On n'invite pas par e-mail : chercher un compte par son adresse
-- révélerait qui est inscrit. Le propriétaire crée un lien à usage
-- unique et le transmet lui-même ; la personne qui l'ouvre reçoit la clé.
-- Aucune policy : la table n'est lisible et modifiable que par les
-- fonctions ci-dessous.

CREATE TABLE IF NOT EXISTS public.drawer_invites (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  drawer_id         UUID        NOT NULL REFERENCES public.drawers(id) ON DELETE CASCADE,
  -- 64 caractères hexadécimaux, issus de deux UUID v4 (≈ 244 bits aléatoires).
  token             TEXT        NOT NULL UNIQUE
                                  DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  role              TEXT        NOT NULL CHECK (role IN ('editor', 'viewer')),
  -- Durée de la clé une fois acceptée ; NULL = sans limite.
  key_expires_at    TIMESTAMPTZ,
  -- Durée de validité du lien lui-même.
  invite_expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  created_by        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_by       UUID                 REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at       TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drawer_invites_drawer_id_idx   ON public.drawer_invites (drawer_id);
CREATE INDEX IF NOT EXISTS drawer_invites_created_by_idx  ON public.drawer_invites (created_by);
CREATE INDEX IF NOT EXISTS drawer_invites_accepted_by_idx ON public.drawer_invites (accepted_by);

ALTER TABLE public.drawer_invites ENABLE ROW LEVEL SECURITY;

-- ── Règles de la serrure ──────────────────────────────────────────

-- Rôle de la clé valide que l'appelant détient sur ce Tiroir, ou NULL.
CREATE OR REPLACE FUNCTION public.drawer_role(p_drawer_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT m.role
  FROM public.drawer_members m
  WHERE m.drawer_id = p_drawer_id
    AND m.user_id   = auth.uid()
    AND (m.role = 'owner' OR m.expires_at IS NULL OR m.expires_at > now())
$$;

-- Miroir de peutFaire (v4/domain/serrure.ts).
-- Actions : voir, modifier, preter, gerer_membres.
CREATE OR REPLACE FUNCTION public.drawer_can(p_drawer_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_serrure TEXT;
  v_role    TEXT;
  v_rang    INT;
  v_min     INT;
BEGIN
  SELECT d.serrure INTO v_serrure FROM public.drawers d WHERE d.id = p_drawer_id;
  IF v_serrure IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  v_role := public.drawer_role(p_drawer_id);

  IF v_role = 'owner' THEN RETURN true; END IF;
  IF v_serrure = 'ouvert' AND p_action = 'voir' THEN RETURN true; END IF;
  IF v_serrure = 'ferme' OR v_role IS NULL THEN RETURN false; END IF;

  v_rang := CASE v_role WHEN 'editor' THEN 2 ELSE 1 END;
  v_min  := CASE p_action
              WHEN 'voir'     THEN 1
              WHEN 'modifier' THEN 2
              ELSE 3                     -- preter, gerer_membres : propriétaire
            END;
  RETURN v_rang >= v_min;
END;
$$;

-- ── Lecture partagée ──────────────────────────────────────────────
-- Aujourd'hui un Tiroir = le Tiroir unique de son propriétaire : ses
-- objets sont ceux du propriétaire. Si un compte peut un jour posséder
-- plusieurs Tiroirs, ces fonctions devront filtrer par collection.

-- Les Tiroirs dont j'ai une clé et dont la serrure me laisse entrer.
CREATE OR REPLACE FUNCTION public.list_my_drawers()
RETURNS TABLE (
  drawer_id        UUID,
  name             TEXT,
  serrure          TEXT,
  role             TEXT,
  owner_name       TEXT,
  key_expires_at   TIMESTAMPTZ,
  object_count     BIGINT,
  collection_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT d.id, d.name, d.serrure, m.role, p.display_name, m.expires_at,
         (SELECT count(*) FROM public.objects o     WHERE o.user_id = d.user_id),
         (SELECT count(*) FROM public.collections c WHERE c.drawer_id = d.id)
  FROM public.drawer_members m
  JOIN public.drawers d       ON d.id = m.drawer_id
  LEFT JOIN public.profiles p ON p.id = d.user_id
  WHERE m.user_id = auth.uid()
    AND public.drawer_can(d.id, 'voir')
  ORDER BY (m.role = 'owner') DESC, d.name
$$;

CREATE OR REPLACE FUNCTION public.list_drawer_collections(p_drawer_id UUID)
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  emoji        TEXT,
  icon_color   TEXT,
  object_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.drawer_can(p_drawer_id, 'voir') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, c.emoji, c.icon_color,
         (SELECT count(*) FROM public.objects o WHERE o.collection_id = c.id)
  FROM public.collections c
  WHERE c.drawer_id = p_drawer_id
  ORDER BY c.pinned_at DESC NULLS LAST, c.created_at;
END;
$$;

-- Objets d'un Tiroir, éventuellement d'une seule de ses collections.
-- cover_path : chemin de la photo de couverture. Le bucket reste privé :
-- l'affichage demandera une URL signée par une fonction serveur qui
-- revérifie drawer_can (étape suivante).
CREATE OR REPLACE FUNCTION public.list_drawer_objects(p_drawer_id UUID, p_collection_id UUID DEFAULT NULL)
RETURNS TABLE (
  id            UUID,
  collection_id UUID,
  title         TEXT,
  description   TEXT,
  status        TEXT,
  location_note TEXT,
  quantity      INTEGER,
  cover_path    TEXT,
  updated_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF NOT public.drawer_can(p_drawer_id, 'voir') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT d.user_id INTO v_owner FROM public.drawers d WHERE d.id = p_drawer_id;

  RETURN QUERY
  SELECT o.id, o.collection_id, o.title, o.description, o.status,
         o.location_note, o.quantity,
         (SELECT i.storage_path FROM public.object_images i
           WHERE i.object_id = o.id
           ORDER BY i.is_cover DESC, i.position
           LIMIT 1),
         o.updated_at
  FROM public.objects o
  WHERE o.user_id = v_owner
    AND (p_collection_id IS NULL OR o.collection_id = p_collection_id)
  ORDER BY o.updated_at DESC;
END;
$$;

-- Qui détient une clé de ce Tiroir.
CREATE OR REPLACE FUNCTION public.list_drawer_members(p_drawer_id UUID)
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  role         TEXT,
  expires_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.drawer_can(p_drawer_id, 'voir') OR public.drawer_role(p_drawer_id) IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT m.user_id, p.display_name, m.role, m.expires_at
  FROM public.drawer_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.drawer_id = p_drawer_id
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, p.display_name;
END;
$$;

-- ── Gestion (propriétaire) ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_drawer_serrure(p_drawer_id UUID, p_serrure TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.drawer_can(p_drawer_id, 'gerer_membres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  UPDATE public.drawers SET serrure = p_serrure WHERE id = p_drawer_id;
END;
$$;

-- Crée un lien d'invitation et renvoie son jeton.
CREATE OR REPLACE FUNCTION public.create_drawer_invite(
  p_drawer_id      UUID,
  p_role           TEXT,
  p_key_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  IF NOT public.drawer_can(p_drawer_id, 'gerer_membres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_key_expires_at IS NOT NULL AND p_key_expires_at <= now() THEN
    RAISE EXCEPTION 'KEY_ALREADY_EXPIRED' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.drawer_invites (drawer_id, role, key_expires_at, created_by)
  VALUES (p_drawer_id, p_role, p_key_expires_at, auth.uid())
  RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_drawer_invite(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_drawer UUID;
BEGIN
  SELECT drawer_id INTO v_drawer FROM public.drawer_invites WHERE token = p_token;
  IF v_drawer IS NULL OR NOT public.drawer_can(v_drawer, 'gerer_membres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  UPDATE public.drawer_invites SET revoked_at = now()
  WHERE token = p_token AND accepted_at IS NULL AND revoked_at IS NULL;
END;
$$;

-- Ouvrir un lien d'invitation : l'appelant reçoit la clé. Un lien ne
-- sert qu'une fois. Un membre qui en accepte un nouveau voit sa clé
-- remplacée ; le propriétaire garde la sienne.
CREATE OR REPLACE FUNCTION public.accept_drawer_invite(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_invite public.drawer_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invite FROM public.drawer_invites
  WHERE token = p_token
  FOR UPDATE;

  -- Un seul message pour tous les refus : ne pas renseigner sur
  -- l'existence d'un jeton.
  IF v_invite.id IS NULL
     OR v_invite.accepted_at IS NOT NULL
     OR v_invite.revoked_at  IS NOT NULL
     OR v_invite.invite_expires_at <= now()
     OR (v_invite.key_expires_at IS NOT NULL AND v_invite.key_expires_at <= now()) THEN
    RAISE EXCEPTION 'INVALID_INVITE' USING ERRCODE = '22023';
  END IF;

  IF public.drawer_role(v_invite.drawer_id) = 'owner' THEN
    RAISE EXCEPTION 'ALREADY_OWNER' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.drawer_members (drawer_id, user_id, role, invited_by, expires_at)
  VALUES (v_invite.drawer_id, auth.uid(), v_invite.role, v_invite.created_by, v_invite.key_expires_at)
  ON CONFLICT (drawer_id, user_id) DO UPDATE
    SET role       = EXCLUDED.role,
        invited_by = EXCLUDED.invited_by,
        expires_at = EXCLUDED.expires_at
    WHERE public.drawer_members.role <> 'owner';

  UPDATE public.drawer_invites
  SET accepted_by = auth.uid(), accepted_at = now()
  WHERE id = v_invite.id;

  RETURN v_invite.drawer_id;
END;
$$;

-- Le propriétaire retire une clé ; un membre peut rendre la sienne.
-- La clé du propriétaire ne se retire pas.
CREATE OR REPLACE FUNCTION public.remove_drawer_member(p_drawer_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT public.drawer_can(p_drawer_id, 'gerer_membres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.drawer_members
  WHERE drawer_id = p_drawer_id AND user_id = p_user_id AND role <> 'owner';
END;
$$;

-- ── Droits d'exécution ────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION
  public.drawer_role(UUID),
  public.drawer_can(UUID, TEXT),
  public.list_my_drawers(),
  public.list_drawer_collections(UUID),
  public.list_drawer_objects(UUID, UUID),
  public.list_drawer_members(UUID),
  public.set_drawer_serrure(UUID, TEXT),
  public.create_drawer_invite(UUID, TEXT, TIMESTAMPTZ),
  public.revoke_drawer_invite(TEXT),
  public.accept_drawer_invite(TEXT),
  public.remove_drawer_member(UUID, UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.drawer_role(UUID),
  public.drawer_can(UUID, TEXT),
  public.list_my_drawers(),
  public.list_drawer_collections(UUID),
  public.list_drawer_objects(UUID, UUID),
  public.list_drawer_members(UUID),
  public.set_drawer_serrure(UUID, TEXT),
  public.create_drawer_invite(UUID, TEXT, TIMESTAMPTZ),
  public.revoke_drawer_invite(TEXT),
  public.accept_drawer_invite(TEXT),
  public.remove_drawer_member(UUID, UUID)
TO authenticated;
