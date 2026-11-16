-- ================================================================
-- 20261113063854_object_for_sale.sql
-- Statut « En vente » et suivi d'une mise en vente (v4/docs/vente.md,
-- étape 1 : Tiroir prépare l'annonce, le propriétaire publie lui-même).
--
-- Cycle : owned/stored → for_sale → sold.
--
-- Le prix DEMANDÉ ne reçoit pas de colonne : c'est sale_price (unitaire)
-- ou sale_price_lot (lot entier), déjà en place. Une colonne de plus
-- ferait deux prix de vente qui se contredisent.
--
-- Colonnes ajoutées :
--   listing_platform  où l'annonce est déposée ('leboncoin' aujourd'hui ;
--                     texte libre borné, pour Vinted ou eBay plus tard)
--   listed_at         date de mise en vente
--   sold_price        prix OBTENU, pour la fiche entière (le lot s'il y en
--                     a un) : comme sale_price_lot, une exception explicite
--                     à la règle des montants unitaires — on encaisse une
--                     somme, pas un prix à l'unité
--   sold_at           date de vente
--
-- Additive : aucune ligne existante n'est modifiée. Une app plus ancienne
-- affiche le statut inconnu tel quel (« for_sale ») sans planter.
-- ================================================================

ALTER TABLE public.objects
  ADD COLUMN IF NOT EXISTS listing_platform TEXT          NULL,
  ADD COLUMN IF NOT EXISTS listed_at        TIMESTAMPTZ   NULL,
  ADD COLUMN IF NOT EXISTS sold_price       NUMERIC(12,2) NULL,
  ADD COLUMN IF NOT EXISTS sold_at          TIMESTAMPTZ   NULL;

ALTER TABLE public.objects
  DROP CONSTRAINT IF EXISTS objects_status_check;
ALTER TABLE public.objects
  ADD CONSTRAINT objects_status_check
  CHECK (status IN ('owned', 'stored', 'loaned', 'for_sale', 'sold', 'given', 'lost'));

ALTER TABLE public.objects
  DROP CONSTRAINT IF EXISTS objects_listing_platform_format;
ALTER TABLE public.objects
  ADD CONSTRAINT objects_listing_platform_format
  CHECK (listing_platform IS NULL OR listing_platform ~ '^[a-z0-9_]{2,32}$');

ALTER TABLE public.objects
  DROP CONSTRAINT IF EXISTS objects_sold_price_positive;
ALTER TABLE public.objects
  ADD CONSTRAINT objects_sold_price_positive
  CHECK (sold_price IS NULL OR sold_price >= 0);

COMMENT ON COLUMN public.objects.listing_platform IS
  'Plateforme ou l annonce est deposee (leboncoin). Tiroir ne publie rien : le proprietaire le declare.';
COMMENT ON COLUMN public.objects.listed_at IS
  'Date de mise en vente (statut for_sale). Le prix demande est sale_price ou sale_price_lot.';
COMMENT ON COLUMN public.objects.sold_price IS
  'Prix obtenu a la vente, pour la fiche entiere (lot compris). Exception explicite a la regle des montants unitaires.';
COMMENT ON COLUMN public.objects.sold_at IS
  'Date de vente (statut sold).';

-- ── Fonctions qui valident le statut ───────────────────────────────
-- patch_object et confirm_change_proposal portent chacune la liste des
-- statuts en dur, une seule fois. Plutôt que de recopier leur corps ici
-- (et d'écraser une version de production qui aurait dérivé du dépôt), on
-- insère 'for_sale' dans la définition en place. Droits, SECURITY DEFINER
-- et search_path sont conservés par CREATE OR REPLACE.
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname, p.prosrc
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('patch_object', 'confirm_change_proposal')
  LOOP
    IF f.prosrc LIKE '%''for_sale''%' THEN
      CONTINUE;
    END IF;
    IF f.prosrc NOT LIKE '%''sold''%' THEN
      RAISE EXCEPTION 'Liste des statuts introuvable dans %', f.proname;
    END IF;
    EXECUTE replace(pg_get_functiondef(f.oid), '''sold''', '''for_sale'', ''sold''');
  END LOOP;
END $$;
