-- ================================================================
-- business_billing.sql — BROUILLON (formule Business, Stripe Billing)
--
-- Une organisation, ses membres (owner / admin / member), un abonnement
-- Stripe par siège (un siège = un membre actif), payé sur facture
-- (virement ou prélèvement SEPA, échéance 30 jours).
--
-- Droits : tant que l'abonnement est actif, chaque membre a le palier
-- 'pro' existant (profiles.plan), avec pro_expires_at = fin de la période
-- + délai de grâce : à l'échéance, effective_plan() le fait retomber en
-- gratuit sans tâche planifiée, comme un Pro sur facture.
--
-- NE TOUCHE PAS aux comptes Premium ni aux Pro attribués à la main : un
-- membre qui a déjà un palier payant le garde, et l'organisation ne lui
-- reprend jamais rien (org_members.pro_granted dit qui a reçu le Pro de
-- l'organisation, profiles.pro_invoice_ref = 'org:<id>' le confirme).
--
-- ADDITIF. Écritures réservées au serveur (service_role) ; un membre lit
-- son organisation et ses collègues, les factures sont lues par l'owner
-- et les admins.
-- ================================================================

-- ── 1. Organisations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT        NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  -- Mentions de la facture du client (raison sociale, SIREN, TVA, adresse).
  legal_name             TEXT,
  siren                  TEXT,
  vat_number             TEXT,
  billing_email          TEXT        NOT NULL,
  address_line1          TEXT,
  address_line2          TEXT,
  postal_code            TEXT,
  city                   TEXT,
  country                TEXT        NOT NULL DEFAULT 'FR',
  -- Miroir de Stripe, tenu à jour par le webhook.
  stripe_customer_id     TEXT        UNIQUE,
  stripe_subscription_id TEXT        UNIQUE,
  subscription_status    TEXT,       -- statut Stripe tel quel (active, past_due, unpaid, canceled…)
  seat_quantity          INTEGER,    -- sièges facturés
  seat_unit_amount       INTEGER,    -- centimes TTC par siège et par mois
  current_period_end     TIMESTAMPTZ,
  -- Dernier jour des droits Pro des membres (fin de période + grâce).
  pro_access_until       DATE,
  livemode               BOOLEAN,
  created_by             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Membres ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_members (
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  -- Vrai si c'est l'organisation qui a donné le Pro à ce compte.
  pro_granted BOOLEAN     NOT NULL DEFAULT false,
  added_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at  TIMESTAMPTZ,
  PRIMARY KEY (org_id, user_id)
);
-- Un compte n'est membre actif que d'une organisation à la fois.
CREATE UNIQUE INDEX IF NOT EXISTS org_members_one_org_idx ON public.org_members (user_id) WHERE status = 'active';
-- Un seul owner actif par organisation.
CREATE UNIQUE INDEX IF NOT EXISTS org_members_one_owner_idx ON public.org_members (org_id) WHERE role = 'owner' AND status = 'active';

-- ── 3. Factures Business (miroir de Stripe) ──────────────────────
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  stripe_invoice_id  TEXT        PRIMARY KEY,       -- in_…
  org_id             UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  number             TEXT,                          -- numéro continu Stripe (ex. TIROIR-0001)
  status             TEXT        NOT NULL,          -- draft, open, paid, uncollectible, void
  currency           TEXT        NOT NULL DEFAULT 'eur',
  amount_due         INTEGER     NOT NULL DEFAULT 0, -- centimes TTC
  amount_paid        INTEGER     NOT NULL DEFAULT 0,
  amount_remaining   INTEGER     NOT NULL DEFAULT 0,
  seats              INTEGER,
  period_start       TIMESTAMPTZ,
  period_end         TIMESTAMPTZ,
  due_date           TIMESTAMPTZ,
  paid_at            TIMESTAMPTZ,
  payment_method     TEXT,                          -- sepa_debit, customer_balance (virement), out_of_band…
  hosted_invoice_url TEXT,
  invoice_pdf        TEXT,
  livemode           BOOLEAN     NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_invoices_org_idx ON public.billing_invoices (org_id, created_at DESC);

-- ── 4. Rôle de l'appelant dans une organisation ──────────────────
-- SECURITY DEFINER : les politiques ci-dessous l'appellent sans relire
-- org_members sous RLS (pas de récursion).
CREATE OR REPLACE FUNCTION public.my_org_role(p_org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT role FROM public.org_members
   WHERE org_id = p_org_id AND user_id = auth.uid() AND status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION public.my_org_role(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_org_role(UUID) TO authenticated;

ALTER TABLE public.organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations: members read" ON public.organizations;
CREATE POLICY "organizations: members read" ON public.organizations
  FOR SELECT USING (public.my_org_role(id) IS NOT NULL);

DROP POLICY IF EXISTS "org_members: members read" ON public.org_members;
CREATE POLICY "org_members: members read" ON public.org_members
  FOR SELECT USING (public.my_org_role(org_id) IS NOT NULL);

DROP POLICY IF EXISTS "billing_invoices: owner and admins read" ON public.billing_invoices;
CREATE POLICY "billing_invoices: owner and admins read" ON public.billing_invoices
  FOR SELECT USING (public.my_org_role(org_id) IN ('owner', 'admin'));

REVOKE INSERT, UPDATE, DELETE ON public.organizations, public.org_members, public.billing_invoices
  FROM PUBLIC, anon, authenticated;

-- ── 5. Sièges ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.org_seat_count(p_org_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT count(*)::INTEGER FROM public.org_members WHERE org_id = p_org_id AND status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION public.org_seat_count(UUID) FROM PUBLIC, anon, authenticated;

-- ── 6. Droits Pro des membres (serveur) ──────────────────────────
-- À rappeler après chaque changement de membres ou d'abonnement. Donne le
-- Pro jusqu'à pro_access_until aux membres actifs sans palier payant ; le
-- reprend aux membres retirés, ou à tous quand les droits sont échus —
-- seulement là où c'est l'organisation qui l'avait donné.
-- Renvoie le nombre de comptes modifiés.
CREATE OR REPLACE FUNCTION public.sync_org_entitlements(p_org_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org   public.organizations%ROWTYPE;
  v_ref   TEXT := 'org:' || p_org_id::TEXT;
  v_live  BOOLEAN;
  v_n     INTEGER := 0;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_org FROM public.organizations WHERE id = p_org_id FOR UPDATE;
  IF v_org.id IS NULL THEN RAISE EXCEPTION 'Organisation inconnue'; END IF;
  v_live := v_org.pro_access_until IS NOT NULL AND v_org.pro_access_until >= CURRENT_DATE;

  -- Reprendre : membres retirés, ou droits échus.
  WITH gone AS (
    UPDATE public.org_members m SET pro_granted = false
     WHERE m.org_id = p_org_id AND m.pro_granted
       AND (m.status = 'removed' OR NOT v_live)
    RETURNING m.user_id
  )
  UPDATE public.profiles p SET
    plan = 'free', pro_since = NULL, pro_expires_at = NULL, pro_invoice_ref = NULL, pro_company = NULL
    FROM gone
   WHERE p.id = gone.user_id AND p.pro_invoice_ref = v_ref;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_n := v_n + v_count;

  IF NOT v_live THEN RETURN v_n; END IF;

  -- Donner (ou prolonger) : membres actifs sans palier payant à eux, ou
  -- qui tiennent déjà leur Pro de cette organisation.
  WITH eligible AS (
    SELECT m.user_id FROM public.org_members m
      JOIN public.profiles p ON p.id = m.user_id
     WHERE m.org_id = p_org_id AND m.status = 'active'
       AND (p.pro_invoice_ref = v_ref OR public.effective_plan(p.plan, p.pro_expires_at) = 'free')
  ), granted AS (
    UPDATE public.org_members m SET pro_granted = true
      FROM eligible e WHERE m.org_id = p_org_id AND m.user_id = e.user_id
    RETURNING m.user_id
  )
  UPDATE public.profiles p SET
    plan            = 'pro',
    pro_since       = CASE WHEN p.pro_invoice_ref = v_ref THEN COALESCE(p.pro_since, CURRENT_DATE) ELSE CURRENT_DATE END,
    pro_expires_at  = v_org.pro_access_until,
    pro_invoice_ref = v_ref,
    pro_company     = v_org.name
    FROM granted
   WHERE p.id = granted.user_id
     AND (p.plan IS DISTINCT FROM 'pro' OR p.pro_expires_at IS DISTINCT FROM v_org.pro_access_until
          OR p.pro_invoice_ref IS DISTINCT FROM v_ref OR p.pro_company IS DISTINCT FROM v_org.name);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_n := v_n + v_count;

  -- Les membres actifs qui gardent leur propre palier payant ne sont pas
  -- marqués pro_granted : l'organisation ne leur reprendra rien.
  UPDATE public.org_members m SET pro_granted = false
    FROM public.profiles p
   WHERE m.org_id = p_org_id AND m.status = 'active' AND m.pro_granted
     AND p.id = m.user_id AND p.pro_invoice_ref IS DISTINCT FROM v_ref;

  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_org_entitlements(UUID) FROM PUBLIC, anon, authenticated;

-- ── 7. Ajouter / retirer un membre (serveur) ─────────────────────
-- L'appelant (route API) a déjà vérifié que le demandeur est owner ou
-- admin. Renvoie { status, seats } ; status : OK, ALREADY_MEMBER,
-- IN_OTHER_ORG, NOT_MEMBER, OWNER.
CREATE OR REPLACE FUNCTION public.org_add_member(p_org_id UUID, p_user_id UUID, p_role TEXT, p_by UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF p_role NOT IN ('owner', 'admin', 'member') THEN RAISE EXCEPTION 'Rôle invalide'; END IF;
  PERFORM 1 FROM public.organizations WHERE id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organisation inconnue'; END IF;

  SELECT status INTO v_status FROM public.org_members WHERE org_id = p_org_id AND user_id = p_user_id;
  IF v_status = 'active' THEN
    RETURN jsonb_build_object('status', 'ALREADY_MEMBER', 'seats', public.org_seat_count(p_org_id));
  END IF;
  IF EXISTS (SELECT 1 FROM public.org_members WHERE user_id = p_user_id AND status = 'active') THEN
    RETURN jsonb_build_object('status', 'IN_OTHER_ORG', 'seats', public.org_seat_count(p_org_id));
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role, status, added_by, added_at, removed_at)
  VALUES (p_org_id, p_user_id, p_role, 'active', p_by, now(), NULL)
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active', added_by = EXCLUDED.added_by, added_at = now(), removed_at = NULL;

  PERFORM public.sync_org_entitlements(p_org_id);
  RETURN jsonb_build_object('status', 'OK', 'seats', public.org_seat_count(p_org_id));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.org_add_member(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.org_remove_member(p_org_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  PERFORM 1 FROM public.organizations WHERE id = p_org_id FOR UPDATE;
  SELECT role INTO v_role FROM public.org_members
   WHERE org_id = p_org_id AND user_id = p_user_id AND status = 'active';
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('status', 'NOT_MEMBER', 'seats', public.org_seat_count(p_org_id));
  END IF;
  -- L'owner ne se retire pas : on transfère d'abord (back-office).
  IF v_role = 'owner' THEN
    RETURN jsonb_build_object('status', 'OWNER', 'seats', public.org_seat_count(p_org_id));
  END IF;

  UPDATE public.org_members SET status = 'removed', removed_at = now()
   WHERE org_id = p_org_id AND user_id = p_user_id;
  PERFORM public.sync_org_entitlements(p_org_id);
  RETURN jsonb_build_object('status', 'OK', 'seats', public.org_seat_count(p_org_id));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.org_remove_member(UUID, UUID) FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.organizations IS
  'Clients Business : abonnement Stripe par siège, sur facture (virement ou SEPA, 30 jours).';
COMMENT ON TABLE public.org_members IS
  'Membres d''une organisation Business. Un membre actif = un siège facturé.';
COMMENT ON TABLE public.billing_invoices IS
  'Factures Business, synchronisées depuis Stripe par /api/stripe/webhook.';
