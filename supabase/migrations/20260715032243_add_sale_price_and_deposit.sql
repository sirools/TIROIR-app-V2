-- ================================================================
-- 20260715032243_add_sale_price_and_deposit.sql
-- Fiche objet : prix de vente (champ libre) + caution (montant de la
-- garantie demandée en cas de prêt de l'objet).
-- ================================================================

ALTER TABLE public.objects
  ADD COLUMN IF NOT EXISTS sale_price     numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2) NULL;
