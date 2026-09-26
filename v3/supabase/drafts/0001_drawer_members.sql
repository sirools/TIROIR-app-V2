-- ================================================================
-- BROUILLON V3 — NON APPLIQUÉ
-- 0001_drawer_members.sql
-- Membres d'un Tiroir (le trousseau) + niveau de serrure.
--
-- Phase 1 du plan (v3/docs/migration-tiroirs-partages.md) : purement
-- additif. Aucune policy existante n'est modifiée ; un membre non
-- propriétaire ne voit donc encore rien du Tiroir d'un autre.
--
-- À rejouer sur le Supabase de PREPROD avant toute copie dans
-- supabase/migrations/.
-- ================================================================

-- ── Serrure du Tiroir ─────────────────────────────────────────────
-- ferme      : visible du seul propriétaire (comportement V2)
-- entrouvert : visible des membres, selon leur rôle
-- ouvert     : visible des membres, et en lecture publique (vitrine)
-- Doit rester aligné avec v3/domain/serrure.ts.

ALTER TABLE public.drawers
  ADD COLUMN IF NOT EXISTS serrure TEXT NOT NULL DEFAULT 'ferme'
    CHECK (serrure IN ('ferme', 'entrouvert', 'ouvert'));

-- ── drawer_members ────────────────────────────────────────────────
-- Une ligne = une clé du trousseau : une personne, un Tiroir, un rôle,
-- éventuellement une date d'expiration (clé confiée temporairement).

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

-- Un seul propriétaire par Tiroir.
CREATE UNIQUE INDEX IF NOT EXISTS drawer_members_one_owner_idx
  ON public.drawer_members (drawer_id) WHERE role = 'owner';

CREATE INDEX IF NOT EXISTS drawer_members_user_id_idx    ON public.drawer_members (user_id);
CREATE INDEX IF NOT EXISTS drawer_members_invited_by_idx ON public.drawer_members (invited_by);

CREATE TRIGGER set_drawer_members_updated_at
  BEFORE UPDATE ON public.drawer_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.drawer_members ENABLE ROW LEVEL SECURITY;

-- Lecture : chacun voit ses propres clés. Aucune écriture client :
-- les invitations passeront par des RPC (phase 4).
CREATE POLICY "drawer_members: select own"
  ON public.drawer_members FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ── Backfill : chaque Tiroir existant a son propriétaire ─────────

INSERT INTO public.drawer_members (drawer_id, user_id, role)
SELECT id, user_id, 'owner'
FROM public.drawers
ON CONFLICT (drawer_id, user_id) DO NOTHING;

-- ── Tout nouveau Tiroir reçoit sa clé propriétaire ───────────────
-- Couvre handle_new_user sans le modifier.

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

CREATE TRIGGER on_drawer_created_add_owner
  AFTER INSERT ON public.drawers
  FOR EACH ROW EXECUTE FUNCTION public.add_drawer_owner_member();

-- ── Helper pour les policies des phases suivantes ────────────────
-- Non utilisé par les policies actuelles. Vrai si l'utilisateur courant
-- détient une clé valide d'au moins p_min_role sur le Tiroir.

CREATE OR REPLACE FUNCTION public.is_drawer_member(p_drawer_id UUID, p_min_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drawer_members m
    WHERE m.drawer_id = p_drawer_id
      AND m.user_id   = (SELECT auth.uid())
      AND (m.expires_at IS NULL OR m.expires_at > now())
      AND CASE m.role WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 ELSE 1 END
       >= CASE p_min_role WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 ELSE 1 END
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_drawer_member(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_drawer_member(UUID, TEXT) TO authenticated;
