-- ================================================================
-- 20260806201400_object_sale_price_lot.sql
-- objects.sale_price_lot : prix négocié pour le lot entier.
--
-- SEULE exception à la règle des montants unitaires posée par
-- 20260806185511_object_quantity.sql — et elle est explicite.
--
-- Le besoin est réel et ne concerne que la vente : on cède 6 chaises à
-- 250 € au lieu de 270 €. Personne ne négocie une « valeur marché de lot »
-- ni une caution dégressive, donc aucun autre montant n'a d'équivalent.
--
-- Pourquoi une colonne dédiée plutôt qu'un total saisissable : rendre le
-- total éditable obligerait soit à diviser à l'envers pour retrouver
-- l'unitaire — avec dérive d'arrondi, et réécriture silencieuse de la
-- valeur qui alimente toutes les sommes de patrimoine — soit à laisser
-- deux montants se contredire sans dire lequel gagne. Ici l'unitaire reste
-- intact, et NULL signifie sans ambiguïté « pas de remise ».
--
-- Lecture : COALESCE(sale_price_lot, sale_price * quantity).
-- ================================================================

ALTER TABLE public.objects
  ADD COLUMN IF NOT EXISTS sale_price_lot NUMERIC(12,2) NULL;

ALTER TABLE public.objects
  DROP CONSTRAINT IF EXISTS objects_sale_price_lot_positive;

ALTER TABLE public.objects
  ADD CONSTRAINT objects_sale_price_lot_positive CHECK (sale_price_lot IS NULL OR sale_price_lot >= 0);

COMMENT ON COLUMN public.objects.sale_price_lot IS
  'Prix de vente négocié pour le lot entier. NULL = pas de remise, le total se dérive de sale_price x quantity. Seule exception a la regle des montants unitaires, et elle est explicite.';
