-- ================================================================
-- 0003_collection_suggestions.sql — BROUILLON, non appliqué
-- Suggestions d'objets sur une collection partagée par lien.
--
-- Un visiteur d'un lien de partage propose un objet au propriétaire ; le
-- propriétaire garde (→ idée) ou écarte, avec annulation possible.
--
-- Trois états d'un objet dans la grille d'une collection :
--   owned      l'objet possédé, tel qu'aujourd'hui : une ligne de `objects`
--   idea       une idée validée par le propriétaire
--   suggested  une suggestion en attente de tri
--
-- Pourquoi une table à part et pas une colonne sur `objects` : les versions
-- déjà installées de l'app lisent `objects` sans filtre (recherche, compteurs,
-- plafonds, exports — voir v4/docs/migration-tiroir-partage.md). Une idée ou
-- une suggestion stockée là y apparaîtrait comme un objet possédé, sans
-- correctif possible. Ici, tout ce qui est dans `objects` est « owned » par
-- construction : aucune ligne existante n'est touchée, aucune n'est déplacée.
-- La future conversion « Je l'ai acheté » créera le vrai objet.
--
-- Purement additif :
--   - collections.suggestions_enabled (false par défaut : lecture seule) ;
--   - share_links.collection_id (NULL pour les liens existants) ;
--   - tables collection_wishes et wish_offers ;
--   - fonctions ci-dessous, seules portes d'écriture.
-- Aucune policy existante n'est modifiée.
-- ================================================================

-- ── Réglage de partage, collection par collection ────────────────

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS suggestions_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.collections.suggestions_enabled IS
  'Les destinataires d''un lien de partage de cette collection peuvent suggérer des objets. Désactivé par défaut.';

-- ── Rattachement d'un lien de partage à sa collection ────────────
-- Les liens V2 ne sont qu'une liste d'objets. Ceux créés depuis une
-- collection pourront la renseigner ; pour les autres, la collection se
-- déduit (voir share_link_collection_id).

ALTER TABLE public.share_links
  ADD COLUMN IF NOT EXISTS collection_id UUID NULL
    REFERENCES public.collections(id) ON DELETE SET NULL;

-- ── Idées et suggestions ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collection_wishes (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id  UUID          NOT NULL,
  -- Propriétaire de la collection (pas l'auteur) : c'est lui que la RLS protège.
  owner_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         TEXT          NOT NULL DEFAULT 'suggested'
                                 CHECK (status IN ('suggested', 'idea', 'dismissed')),
  title          TEXT          NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  url            TEXT          NULL CHECK (url IS NULL OR (char_length(url) <= 2000 AND url ~* '^https?://')),
  price          NUMERIC(12,2) NULL CHECK (price IS NULL OR price BETWEEN 0 AND 10000000),
  currency       TEXT          NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  -- Auteur de la suggestion ; NULL pour une idée ajoutée par le propriétaire
  -- (plus tard) ou si l'auteur supprime son compte.
  suggested_by   UUID          NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  share_link_id  UUID          NULL REFERENCES public.share_links(id) ON DELETE SET NULL,
  decided_at     TIMESTAMPTZ   NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT collection_wishes_collection_owner_fk
    FOREIGN KEY (collection_id, owner_id)
    REFERENCES public.collections(id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.collection_wishes IS
  'Idées (status idea) et suggestions (suggested / dismissed) d''une collection. Les objets possédés restent dans objects.';

CREATE INDEX IF NOT EXISTS collection_wishes_collection_idx ON public.collection_wishes (collection_id, status);
CREATE INDEX IF NOT EXISTS collection_wishes_owner_idx      ON public.collection_wishes (owner_id);
CREATE INDEX IF NOT EXISTS collection_wishes_author_idx     ON public.collection_wishes (suggested_by);
CREATE INDEX IF NOT EXISTS collection_wishes_link_idx       ON public.collection_wishes (share_link_id);

DROP TRIGGER IF EXISTS set_collection_wishes_updated_at ON public.collection_wishes;
CREATE TRIGGER set_collection_wishes_updated_at
  BEFORE UPDATE ON public.collection_wishes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.collection_wishes ENABLE ROW LEVEL SECURITY;

-- Lecture : le propriétaire seulement. Les visiteurs passent par le serveur
-- web (clé service), qui filtre ce qu'il montre.
DROP POLICY IF EXISTS "collection_wishes: select own" ON public.collection_wishes;
CREATE POLICY "collection_wishes: select own"
  ON public.collection_wishes FOR SELECT
  USING ((SELECT auth.uid()) = owner_id);

-- Aucune policy d'écriture : tout passe par les fonctions ci-dessous.
REVOKE INSERT, UPDATE, DELETE ON public.collection_wishes FROM anon, authenticated;
REVOKE ALL ON public.collection_wishes FROM anon;

-- ── Offres rattachées à une idée ─────────────────────────────────
-- Structure prête pour les futures sources marchandes (neuf, occasion) ;
-- rien ne la remplit encore.

CREATE TABLE IF NOT EXISTS public.wish_offers (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id       UUID          NOT NULL REFERENCES public.collection_wishes(id) ON DELETE CASCADE,
  owner_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url           TEXT          NOT NULL CHECK (char_length(url) <= 2000 AND url ~* '^https?://'),
  price         NUMERIC(12,2) NULL CHECK (price IS NULL OR price >= 0),
  currency      TEXT          NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  merchant      TEXT          NULL CHECK (merchant IS NULL OR char_length(merchant) <= 200),
  image_url     TEXT          NULL CHECK (image_url IS NULL OR char_length(image_url) <= 2000),
  availability  TEXT          NOT NULL DEFAULT 'unknown'
                                CHECK (availability IN ('in_stock', 'out_of_stock', 'preorder', 'unknown')),
  condition     TEXT          NOT NULL DEFAULT 'new'
                                CHECK (condition IN ('new', 'used', 'refurbished')),
  -- D'où vient l'offre : 'manual', puis le nom de l'API marchande.
  source        TEXT          NOT NULL DEFAULT 'manual',
  observed_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wish_offers_wish_idx  ON public.wish_offers (wish_id);
CREATE INDEX IF NOT EXISTS wish_offers_owner_idx ON public.wish_offers (owner_id);

ALTER TABLE public.wish_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wish_offers: select own" ON public.wish_offers;
CREATE POLICY "wish_offers: select own"
  ON public.wish_offers FOR SELECT
  USING ((SELECT auth.uid()) = owner_id);

REVOKE INSERT, UPDATE, DELETE ON public.wish_offers FROM anon, authenticated;
REVOKE ALL ON public.wish_offers FROM anon;

-- ── share_link_collection_id ─────────────────────────────────────
-- La collection d'un lien : celle qu'il déclare, sinon celle de TOUS ses
-- objets si elle est unique. Un lien qui mélange plusieurs collections, ou
-- des objets hors collection, n'en a pas : pas de suggestions possibles.
-- La collection doit appartenir au propriétaire du lien.

CREATE OR REPLACE FUNCTION public.share_link_collection_id(p_link_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH link AS (
    SELECT id, user_id, collection_id, object_ids FROM public.share_links WHERE id = p_link_id
  ),
  derived AS (
    SELECT CASE
      WHEN count(*) = 0 THEN NULL
      WHEN count(*) FILTER (WHERE o.collection_id IS NULL) > 0 THEN NULL
      WHEN count(DISTINCT o.collection_id) = 1 THEN min(o.collection_id::text)::uuid
    END AS collection_id
    FROM link l
    JOIN public.objects o ON o.id = ANY (l.object_ids) AND o.user_id = l.user_id
  )
  SELECT c.id
  FROM link l
  JOIN public.collections c
    ON c.id = coalesce(l.collection_id, (SELECT collection_id FROM derived))
   AND c.user_id = l.user_id
$$;

-- ── create_collection_suggestion ─────────────────────────────────
-- Appelée par le serveur web (clé service) une fois vérifiés : la session
-- de l'auteur et, pour un lien protégé, le mot de passe. Ces deux preuves
-- vivent côté web (cookie signé), d'où l'absence de droit pour
-- `authenticated` : sinon un compte connaissant le jeton contournerait le
-- mot de passe.

CREATE OR REPLACE FUNCTION public.create_collection_suggestion(
  p_share_token TEXT,
  p_author_id   UUID,
  p_title       TEXT,
  p_url         TEXT DEFAULT NULL,
  p_price       NUMERIC DEFAULT NULL,
  p_currency    TEXT DEFAULT 'EUR'
)
RETURNS public.collection_wishes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_link    public.share_links%ROWTYPE;
  v_coll_id UUID;
  v_enabled BOOLEAN;
  v_pending INTEGER;
  v_row     public.collection_wishes%ROWTYPE;
BEGIN
  IF p_author_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO v_link FROM public.share_links WHERE token = p_share_token;
  IF NOT FOUND OR v_link.is_archived
     OR (v_link.expires_at IS NOT NULL AND v_link.expires_at <= now()) THEN
    RAISE EXCEPTION 'LINK_UNAVAILABLE';
  END IF;

  IF v_link.user_id = p_author_id THEN RAISE EXCEPTION 'OWNER_CANNOT_SUGGEST'; END IF;

  v_coll_id := public.share_link_collection_id(v_link.id);
  IF v_coll_id IS NULL THEN RAISE EXCEPTION 'SUGGESTIONS_DISABLED'; END IF;

  SELECT suggestions_enabled INTO v_enabled FROM public.collections WHERE id = v_coll_id;
  IF NOT coalesce(v_enabled, false) THEN RAISE EXCEPTION 'SUGGESTIONS_DISABLED'; END IF;

  -- Garde-fou contre l'inondation : 50 suggestions en attente par auteur et
  -- par collection. Le propriétaire trie, l'auteur peut en proposer d'autres.
  SELECT count(*) INTO v_pending
  FROM public.collection_wishes
  WHERE collection_id = v_coll_id AND suggested_by = p_author_id AND status = 'suggested';
  IF v_pending >= 50 THEN RAISE EXCEPTION 'TOO_MANY_PENDING'; END IF;

  INSERT INTO public.collection_wishes
    (collection_id, owner_id, status, title, url, price, currency, suggested_by, share_link_id)
  VALUES
    (v_coll_id, v_link.user_id, 'suggested', btrim(p_title),
     nullif(btrim(p_url), ''), p_price, coalesce(upper(p_currency), 'EUR'),
     p_author_id, v_link.id)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── Tri côté propriétaire ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.triage_collection_wish(p_wish_id UUID, p_decision TEXT)
RETURNS public.collection_wishes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row public.collection_wishes%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('keep', 'dismiss') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;

  UPDATE public.collection_wishes
     SET status = CASE p_decision WHEN 'keep' THEN 'idea' ELSE 'dismissed' END,
         decided_at = now()
   WHERE id = p_wish_id
     AND owner_id = (SELECT auth.uid())
     AND status = 'suggested'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  RETURN v_row;
END;
$$;

-- Annule un tri : la suggestion revient en attente.
CREATE OR REPLACE FUNCTION public.undo_collection_wish_triage(p_wish_id UUID)
RETURNS public.collection_wishes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row public.collection_wishes%ROWTYPE;
BEGIN
  UPDATE public.collection_wishes
     SET status = 'suggested',
         decided_at = NULL
   WHERE id = p_wish_id
     AND owner_id = (SELECT auth.uid())
     AND status IN ('idea', 'dismissed')
     AND suggested_by IS NOT NULL
     AND decided_at IS NOT NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  RETURN v_row;
END;
$$;

-- ── Réglage par le propriétaire ──────────────────────────────────
-- La policy UPDATE existante de collections suffirait ; une fonction dédiée
-- évite que le client web écrive dans collections au-delà de ce drapeau.

CREATE OR REPLACE FUNCTION public.set_collection_suggestions(p_collection_id UUID, p_enabled BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.collections
     SET suggestions_enabled = coalesce(p_enabled, false)
   WHERE id = p_collection_id
     AND user_id = (SELECT auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  RETURN coalesce(p_enabled, false);
END;
$$;

-- ── Droits ───────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.share_link_collection_id(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_collection_suggestion(TEXT, UUID, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.triage_collection_wish(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.undo_collection_wish_triage(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_collection_suggestions(UUID, BOOLEAN) FROM PUBLIC, anon;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.share_link_collection_id(UUID) TO service_role;
    GRANT EXECUTE ON FUNCTION public.create_collection_suggestion(TEXT, UUID, TEXT, TEXT, NUMERIC, TEXT) TO service_role;
    GRANT ALL ON public.collection_wishes, public.wish_offers TO service_role;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.triage_collection_wish(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_collection_wish_triage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_collection_suggestions(UUID, BOOLEAN) TO authenticated;
GRANT SELECT ON public.collection_wishes, public.wish_offers TO authenticated;
