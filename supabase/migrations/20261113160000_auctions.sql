-- ================================================================
-- 20261113160000_auctions.sql
-- La salle des ventes du site : enchères privées sur un objet ou un lot,
-- ouvertes par un lien à des invités (v4/docs/vente.md, étape 2 — ici
-- SANS paiement : Tiroir affiche le meilleur enchérisseur, vendeur et
-- acheteur s'arrangent, le vendeur marque « remis »).
--
--   auctions          une vente : le lot, le prix de départ, le prix de
--                     réserve (jamais montré aux invités), la fin, le lien
--   auction_bids      les offres
--   auction_messages  les messages laissés sur la vente
--
-- Accès : aucune politique RLS, donc rien n'est lisible ni inscriptible
-- avec la clé publique. Tout passe par les routes du site
-- (web/pages/api/auctions, web/lib/auctionServer.ts), qui vérifient la
-- session, le lien et son mot de passe avant d'utiliser la clé service.
-- Un invité n'a ainsi jamais accès à la table des objets du vendeur.
--
-- Une offre est posée par place_auction_bid() : la vente est verrouillée
-- le temps de comparer, deux offres simultanées ne peuvent pas passer
-- toutes les deux au même montant.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.auctions (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token          TEXT          NOT NULL UNIQUE,
  title          TEXT          NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  object_ids     UUID[]        NOT NULL CHECK (cardinality(object_ids) BETWEEN 1 AND 20),
  start_price    NUMERIC(12,2) NOT NULL CHECK (start_price > 0),
  reserve_price  NUMERIC(12,2) NULL CHECK (reserve_price IS NULL OR reserve_price >= start_price),
  currency       TEXT          NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  password_hash  TEXT          NULL,
  ends_at        TIMESTAMPTZ   NOT NULL,
  cancelled_at   TIMESTAMPTZ   NULL,
  handed_over_at TIMESTAMPTZ   NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auction_bids (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID          NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  bidder_id  UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount     NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auction_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID        NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auctions_user_idx          ON public.auctions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auctions_objects_idx       ON public.auctions USING GIN (object_ids);
CREATE INDEX IF NOT EXISTS auction_bids_auction_idx   ON public.auction_bids (auction_id, amount DESC, created_at);
CREATE INDEX IF NOT EXISTS auction_bids_bidder_idx    ON public.auction_bids (bidder_id);
CREATE INDEX IF NOT EXISTS auction_messages_auction_idx ON public.auction_messages (auction_id, created_at);

ALTER TABLE public.auctions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.auctions, public.auction_bids, public.auction_messages FROM anon, authenticated;

COMMENT ON TABLE public.auctions IS
  'Encheres privees du site. Sans politique RLS : lecture et ecriture par les routes du site seulement (cle service).';
COMMENT ON COLUMN public.auctions.reserve_price IS
  'Prix de reserve, facultatif. Jamais envoye aux invites : seulement « atteint » ou non.';

-- ── Poser une offre ─────────────────────────────────────────────────
-- Erreurs (message exact, repris par la route) :
--   AUCTION_NOT_FOUND, AUCTION_CLOSED, OWN_AUCTION, BID_TOO_LOW
CREATE OR REPLACE FUNCTION public.place_auction_bid(p_token TEXT, p_bidder UUID, p_amount NUMERIC)
RETURNS public.auction_bids
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_auction public.auctions;
  v_top     NUMERIC;
  v_bid     public.auction_bids;
BEGIN
  SELECT * INTO v_auction FROM public.auctions WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUCTION_NOT_FOUND';
  END IF;
  IF v_auction.cancelled_at IS NOT NULL OR v_auction.ends_at <= now() THEN
    RAISE EXCEPTION 'AUCTION_CLOSED';
  END IF;
  IF v_auction.user_id = p_bidder THEN
    RAISE EXCEPTION 'OWN_AUCTION';
  END IF;

  SELECT max(amount) INTO v_top FROM public.auction_bids WHERE auction_id = v_auction.id;
  -- Le prix de départ, puis au moins 1 au-dessus de la meilleure offre (BID_STEP, web/lib/auction.ts).
  IF p_amount IS NULL OR p_amount < COALESCE(v_top + 1, v_auction.start_price) THEN
    RAISE EXCEPTION 'BID_TOO_LOW';
  END IF;

  INSERT INTO public.auction_bids (auction_id, bidder_id, amount)
  VALUES (v_auction.id, p_bidder, round(p_amount, 2))
  RETURNING * INTO v_bid;
  RETURN v_bid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_auction_bid(TEXT, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_auction_bid(TEXT, UUID, NUMERIC) TO service_role;
