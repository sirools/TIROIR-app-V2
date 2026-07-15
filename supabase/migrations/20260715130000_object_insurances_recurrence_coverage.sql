-- ================================================================
-- 20260715130000_object_insurances_recurrence_coverage.sql
-- Récurrence du coût (mensuel/annuel) + montant de couverture pour
-- les assurances. La colonne `date` sert désormais d'échéance du
-- contrat (optionnelle).
-- ================================================================

alter table public.object_insurances
  add column if not exists billing_period text not null default 'yearly'
    check (billing_period in ('monthly', 'yearly')),
  add column if not exists coverage numeric(12,2) null;
