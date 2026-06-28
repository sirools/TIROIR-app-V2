-- Champs assurance et prix d'achat sur les objets
ALTER TABLE objects
  ADD COLUMN IF NOT EXISTS purchase_price       numeric(12,2)    NULL,
  ADD COLUMN IF NOT EXISTS purchase_currency    text             NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS purchase_date        date             NULL,
  ADD COLUMN IF NOT EXISTS insured              boolean          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_type       text             NULL,
  ADD COLUMN IF NOT EXISTS insurance_coverage   numeric(12,2)    NULL,
  ADD COLUMN IF NOT EXISTS insurance_policy_ref text             NULL,
  ADD COLUMN IF NOT EXISTS insurance_provider   text             NULL,
  ADD COLUMN IF NOT EXISTS insurance_expires_at date             NULL;
