-- ================================================================
-- 20260729032429_admin_pro_accounts.sql
-- Recherche de comptes et liste des clients Professionnels pour le
-- dashboard admin.
--
-- L'e-mail vit dans auth.users, hors de portée de PostgREST : ces deux
-- fonctions SECURITY DEFINER font la jointure. Elles sont réservées au
-- rôle service_role — l'API Next vérifie déjà is_admin sur la session
-- avant de les appeler.
-- ================================================================

CREATE OR REPLACE FUNCTION public.admin_find_users(p_query TEXT)
RETURNS TABLE(
  id              UUID,
  email           TEXT,
  display_name    TEXT,
  plan            TEXT,
  pro_since       DATE,
  pro_expires_at  DATE,
  pro_invoice_ref TEXT,
  pro_company     TEXT,
  created_at      TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $$
  SELECT p.id, u.email::TEXT, p.display_name, p.plan,
         p.pro_since, p.pro_expires_at, p.pro_invoice_ref, p.pro_company,
         p.created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
   WHERE length(btrim(p_query)) >= 2
     AND (u.email ILIKE '%' || btrim(p_query) || '%'
       OR p.display_name ILIKE '%' || btrim(p_query) || '%')
   ORDER BY p.created_at DESC
   LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_pro_accounts()
RETURNS TABLE(
  id              UUID,
  email           TEXT,
  display_name    TEXT,
  plan            TEXT,
  pro_since       DATE,
  pro_expires_at  DATE,
  pro_invoice_ref TEXT,
  pro_company     TEXT,
  created_at      TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $$
  SELECT p.id, u.email::TEXT, p.display_name, p.plan,
         p.pro_since, p.pro_expires_at, p.pro_invoice_ref, p.pro_company,
         p.created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
   WHERE p.plan = 'pro'
   ORDER BY p.pro_since DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.admin_find_users(TEXT)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_pro_accounts()  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_find_users(TEXT)    TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_pro_accounts() TO service_role;
