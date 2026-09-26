-- ================================================================
-- BROUILLON V3 — NON APPLIQUÉ
-- 0002_object_loans.sql
-- Le prêt comme objet de première classe : demande → acceptation →
-- remise → retour, avec emprunteur, usage et échéance.
--
-- Phase 4 du plan (v3/docs/migration-tiroirs-partages.md).
-- Le statut V2 objects.status = 'loaned' est conservé : les futures RPC
-- de prêt le poseront à la remise et le retireront au retour
-- (voir statutObjetPendant dans v3/domain/pret.ts).
-- ================================================================

CREATE TABLE IF NOT EXISTS public.object_loans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id     UUID        NOT NULL REFERENCES public.objects(id) ON DELETE CASCADE,
  -- Prêteur : propriétaire de l'objet au moment du prêt.
  lender_id     UUID        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  -- Emprunteur avec compte Tiroir, ou simple nom (un proche sans compte).
  borrower_id   UUID                 REFERENCES auth.users(id)     ON DELETE SET NULL,
  borrower_name TEXT,
  -- Doit rester aligné avec v3/domain/pret.ts.
  status        TEXT        NOT NULL DEFAULT 'demande'
                              CHECK (status IN ('demande', 'accepte', 'en_cours', 'rendu', 'refuse', 'annule')),
  usage_note    TEXT,
  starts_on     DATE,
  due_on        DATE,
  handed_at     TIMESTAMPTZ,
  returned_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT object_loans_borrower_known CHECK (borrower_id IS NOT NULL OR nullif(trim(borrower_name), '') IS NOT NULL),
  CONSTRAINT object_loans_due_after_start CHECK (due_on IS NULL OR starts_on IS NULL OR due_on >= starts_on),
  CONSTRAINT object_loans_returned_when_rendu CHECK ((status = 'rendu') = (returned_at IS NOT NULL))
);

-- Un objet ne peut être engagé que dans un prêt à la fois.
CREATE UNIQUE INDEX IF NOT EXISTS object_loans_one_active_idx
  ON public.object_loans (object_id) WHERE status IN ('accepte', 'en_cours');

CREATE INDEX IF NOT EXISTS object_loans_object_id_idx   ON public.object_loans (object_id);
CREATE INDEX IF NOT EXISTS object_loans_lender_id_idx   ON public.object_loans (lender_id);
CREATE INDEX IF NOT EXISTS object_loans_borrower_id_idx ON public.object_loans (borrower_id);

CREATE TRIGGER set_object_loans_updated_at
  BEFORE UPDATE ON public.object_loans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.object_loans ENABLE ROW LEVEL SECURITY;

-- Lecture : le prêteur et l'emprunteur. Aucune écriture client :
-- chaque transition passera par une RPC qui applique le cycle de vie.
CREATE POLICY "object_loans: select lender or borrower"
  ON public.object_loans FOR SELECT
  USING ((SELECT auth.uid()) IN (lender_id, borrower_id));
