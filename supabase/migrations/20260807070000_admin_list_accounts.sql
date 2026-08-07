-- ================================================================
-- 20260807070000_admin_list_accounts.sql
-- admin_list_accounts() : parcourir les comptes par palier, avec
-- pagination et de quoi decider.
--
-- L'outil existant ne savait faire que deux choses : lister les comptes
-- 'pro', ou chercher par e-mail. Impossible de voir les abonnes premium,
-- impossible de parcourir les inscriptions recentes autrement qu'en
-- devinant une adresse.
--
-- Le total est rendu par count(*) OVER () sur chaque ligne plutot que par
-- une seconde requete : c'est le meme filtre, il ne doit pas pouvoir
-- diverger de la page affichee.
--
-- On rend aussi le nombre d'objets et la consommation IA : changer
-- quelqu'un de palier sans savoir ce qu'il fait de l'application, c'est
-- decider a l'aveugle.
--
-- effective_plan est calcule ici : un compte 'pro' dont la date de fin est
-- passee est deja retombe en gratuit pour les quotas, l'ecran doit le dire
-- au lieu d'afficher un palier qui ne s'applique plus.
-- ================================================================

CREATE OR REPLACE FUNCTION public.admin_list_accounts(
  p_plan   TEXT    DEFAULT NULL,   -- 'free' | 'premium' | 'pro' | NULL = tous
  p_query  TEXT    DEFAULT NULL,
  p_limit  INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id              UUID,
  email           TEXT,
  display_name    TEXT,
  plan            TEXT,
  effective_plan  TEXT,
  pro_since       DATE,
  pro_expires_at  DATE,
  pro_invoice_ref TEXT,
  pro_company     TEXT,
  created_at      TIMESTAMPTZ,
  objects_count   BIGINT,
  ai_analyses_used INTEGER,
  total_count     BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $$
  SELECT p.id,
         u.email::TEXT,
         p.display_name,
         p.plan,
         public.effective_plan(p.plan, p.pro_expires_at) AS effective_plan,
         p.pro_since,
         p.pro_expires_at,
         p.pro_invoice_ref,
         p.pro_company,
         p.created_at,
         COALESCE(o.n, 0) AS objects_count,
         p.ai_analyses_used,
         count(*) OVER () AS total_count
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN (
      SELECT user_id, count(*) AS n FROM public.objects GROUP BY user_id
    ) o ON o.user_id = p.id
   WHERE (p_plan IS NULL OR public.effective_plan(p.plan, p.pro_expires_at) = p_plan)
     AND (
       p_query IS NULL OR length(btrim(p_query)) < 2
       OR u.email ILIKE '%' || btrim(p_query) || '%'
       OR p.display_name ILIKE '%' || btrim(p_query) || '%'
     )
   -- Les payants d'abord par anciennete de forfait, les gratuits par date
   -- d'inscription : dans les deux cas, ce qu'on vient chercher en premier.
   ORDER BY
     CASE WHEN p.plan = 'pro' THEN p.pro_since END DESC NULLS LAST,
     p.created_at DESC
   LIMIT  GREATEST(1, LEAST(100, COALESCE(p_limit, 25)))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
$$;

REVOKE ALL ON FUNCTION public.admin_list_accounts(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts(TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.admin_list_accounts(TEXT, TEXT, INTEGER, INTEGER) IS
  'Comptes filtres par palier effectif, pagines, avec volume d objets et consommation IA. service_role uniquement.';

-- ── Compteurs par palier ──────────────────────────────────────────
-- Pour afficher « Pro (2) · Premium (1) · Gratuit (22) » sans charger
-- les trois listes.

CREATE OR REPLACE FUNCTION public.admin_plan_counts()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
  SELECT jsonb_object_agg(plan_eff, n)
  FROM (
    SELECT public.effective_plan(plan, pro_expires_at) AS plan_eff, count(*) AS n
    FROM public.profiles
    GROUP BY 1
  ) t;
$$;

REVOKE ALL ON FUNCTION public.admin_plan_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_plan_counts() TO service_role;
