-- ================================================================
-- 0004_share_link_suggestions.sql — BROUILLON, à appliquer après 0003
-- Les ajouts se règlent PAR PARTAGE, depuis l'app, et un visiteur peut
-- proposer des objets de son propre Tiroir.
--
-- 1. Réglage par lien : share_links.options.allow_suggestions (JSONB déjà
--    existant, écrit par l'app : création via create-share-link, édition
--    via la policy « owner can manage »). Les collections déjà activées
--    reportent leur réglage sur leurs liens (ci-dessous).
-- 2. collection_wishes.source_object_id : l'objet du visiteur proposé tel
--    quel (titre et photo repris de son Tiroir).
-- 3. create_share_suggestion : la nouvelle porte d'entrée, qui lit le
--    réglage du lien et accepte un objet de son Tiroir.
--
-- ADDITIF : le site en ligne continue de marcher tel quel. Il appelle
-- create_collection_suggestion et lit collections.suggestions_enabled :
-- les deux restent intacts. Leur retrait viendra dans un 0005 de
-- nettoyage, une fois le site passé au réglage par partage (fil 5).
-- Rejouable. Seule donnée modifiée : le report du réglage sur les liens des
-- collections activées, que le site en ligne ne lit pas.
-- ================================================================

ALTER TABLE public.collection_wishes
  ADD COLUMN IF NOT EXISTS source_object_id UUID NULL
    REFERENCES public.objects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS collection_wishes_source_idx
  ON public.collection_wishes (source_object_id);

-- Report du réglage par collection (0003) sur les liens de ces collections.
UPDATE public.share_links s
   SET options = coalesce(s.options, '{}'::jsonb) || '{"allow_suggestions": true}'::jsonb
  FROM public.collections c
 WHERE c.suggestions_enabled
   AND c.id = public.share_link_collection_id(s.id)
   AND NOT coalesce((s.options ->> 'allow_suggestions')::boolean, false);

-- Nouvelle fonction, sous un NOUVEAU nom : l'ancienne
-- (create_collection_suggestion) reste pour le site en ligne. Un même nom
-- serait ambigu — avec leurs paramètres optionnels, un appel à trois
-- arguments correspondrait aux deux signatures.
CREATE OR REPLACE FUNCTION public.create_share_suggestion(
  p_share_token      TEXT,
  p_author_id        UUID,
  p_title            TEXT DEFAULT NULL,
  p_url              TEXT DEFAULT NULL,
  p_price            NUMERIC DEFAULT NULL,
  p_currency         TEXT DEFAULT 'EUR',
  p_source_object_id UUID DEFAULT NULL
)
RETURNS public.collection_wishes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_link    public.share_links%ROWTYPE;
  v_coll_id UUID;
  v_title   TEXT := nullif(btrim(p_title), '');
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

  -- Le réglage vit sur le partage.
  IF NOT coalesce((v_link.options ->> 'allow_suggestions')::boolean, false) THEN
    RAISE EXCEPTION 'SUGGESTIONS_DISABLED';
  END IF;

  v_coll_id := public.share_link_collection_id(v_link.id);
  IF v_coll_id IS NULL THEN RAISE EXCEPTION 'SUGGESTIONS_DISABLED'; END IF;

  -- Un objet proposé depuis son Tiroir doit être à soi ; son titre fait foi
  -- si aucun n'est donné.
  IF p_source_object_id IS NOT NULL THEN
    SELECT coalesce(v_title, o.title) INTO v_title
    FROM public.objects o
    WHERE o.id = p_source_object_id AND o.user_id = p_author_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_NOT_FOUND'; END IF;

    IF EXISTS (
      SELECT 1 FROM public.collection_wishes
      WHERE collection_id = v_coll_id AND source_object_id = p_source_object_id
        AND status IN ('suggested', 'idea')
    ) THEN
      RAISE EXCEPTION 'ALREADY_SUGGESTED';
    END IF;
  END IF;

  SELECT count(*) INTO v_pending
  FROM public.collection_wishes
  WHERE collection_id = v_coll_id AND suggested_by = p_author_id AND status = 'suggested';
  IF v_pending >= 50 THEN RAISE EXCEPTION 'TOO_MANY_PENDING'; END IF;

  INSERT INTO public.collection_wishes
    (collection_id, owner_id, status, title, url, price, currency, suggested_by, share_link_id, source_object_id)
  VALUES
    (v_coll_id, v_link.user_id, 'suggested', left(v_title, 120),
     nullif(btrim(p_url), ''), p_price, coalesce(upper(p_currency), 'EUR'),
     p_author_id, v_link.id, p_source_object_id)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_share_suggestion(TEXT, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID) FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.create_share_suggestion(TEXT, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID) TO service_role;
  END IF;
END $$;

COMMENT ON COLUMN public.collections.suggestions_enabled IS
  'Remplacé par share_links.options.allow_suggestions (0004). Encore lu par le site en ligne jusqu''au fil 5 ; retiré par 0005.';
