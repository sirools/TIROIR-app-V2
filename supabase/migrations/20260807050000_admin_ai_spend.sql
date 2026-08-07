-- ================================================================
-- 20260807050000_admin_ai_spend.sql
-- get_admin_ai_spend() : la depense IA reelle, a l'echelle de la
-- plateforme, telle que ai_usage l'a mesuree.
--
-- Le tableau de bord affichait jusqu'ici un cout ESTIME : nombre
-- d'analyses x forfait declare a la main dans app_settings (1 c). Ce
-- forfait avait un sens quand il n'existait qu'une analyse. Il en a
-- perdu depuis : une detection de scene coute 0,6 a 12,5 c selon le
-- modele, une vignette Gemini 3,9 c, une description 0,15 c. Piloter
-- une marge sur une moyenne inventee, c'est piloter a l'aveugle.
--
-- Tout est agrege en une seule RPC plutot qu'en six requetes : la page
-- admin fait deja douze allers-retours dans son getServerSideProps, et
-- ces chiffres se lisent ensemble ou pas du tout.
--
-- SECURITY DEFINER + revocation totale : appelable uniquement en
-- service_role, depuis le serveur. Meme regle que get_admin_infra_stats.
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_admin_ai_spend()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  WITH bornes AS (
    SELECT date_trunc('month', now()) AS debut_mois,
           now() - interval '30 days'  AS il_y_a_30j,
           now() - interval '7 days'   AS il_y_a_7j
  )
  SELECT jsonb_build_object(

    -- ── Totaux ────────────────────────────────────────────────────
    'total', (
      SELECT jsonb_build_object(
        'mois_usd',     COALESCE(sum(cost_usd) FILTER (WHERE created_at >= b.debut_mois), 0),
        'j30_usd',      COALESCE(sum(cost_usd) FILTER (WHERE created_at >= b.il_y_a_30j), 0),
        'j7_usd',       COALESCE(sum(cost_usd) FILTER (WHERE created_at >= b.il_y_a_7j), 0),
        'lifetime_usd', COALESCE(sum(cost_usd), 0),
        'appels_mois',  count(*) FILTER (WHERE created_at >= b.debut_mois),
        'appels_total', count(*),
        'users_j30',    count(DISTINCT user_id) FILTER (WHERE created_at >= b.il_y_a_30j),
        'depuis',       min(created_at)
      )
      FROM public.ai_usage, bornes b
    ),

    -- ── Par fonctionnalite, sur 30 jours ──────────────────────────
    -- C'est la maille qui sert a arbitrer : si une fonctionnalite pese
    -- la moitie de la facture pour 3 % des appels, elle se plafonne ou
    -- se change de modele.
    'par_feature', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'cout_usd')::numeric DESC)
      FROM (
        SELECT jsonb_build_object(
          'feature',     feature,
          'appels',      count(*),
          'users',       count(DISTINCT user_id),
          'cout_usd',    COALESCE(sum(cost_usd), 0),
          'cout_moyen',  COALESCE(avg(cost_usd), 0),
          'duree_moy_ms', COALESCE(avg(duration_ms), 0)
        ) AS x
        FROM public.ai_usage, bornes b
        WHERE created_at >= b.il_y_a_30j
        GROUP BY feature
      ) t
    ), '[]'::jsonb),

    -- ── Par modele, sur 30 jours ──────────────────────────────────
    'par_modele', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'cout_usd')::numeric DESC)
      FROM (
        SELECT jsonb_build_object(
          'model',      model,
          'appels',     count(*),
          'cout_usd',   COALESCE(sum(cost_usd), 0),
          'cout_moyen', COALESCE(avg(cost_usd), 0),
          'tokens_in',  COALESCE(sum(input_tokens), 0),
          'tokens_out', COALESCE(sum(output_tokens), 0)
        ) AS x
        FROM public.ai_usage, bornes b
        WHERE created_at >= b.il_y_a_30j
        GROUP BY model
      ) t
    ), '[]'::jsonb),

    -- ── Les plus gros consommateurs, sur 30 jours ─────────────────
    -- La moyenne ne dit rien d'utile sur une distribution a longue
    -- traine : c'est la tete de liste qui decide s'il faut des packs
    -- de credits ou seulement un plafond.
    'top_users', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'cout_usd')::numeric DESC)
      FROM (
        SELECT jsonb_build_object(
          'user_id',  u.user_id,
          'email',    p.email,
          'plan',     public.effective_plan(pr.plan, pr.pro_expires_at),
          'appels',   u.appels,
          'cout_usd', u.cout_usd
        ) AS x
        FROM (
          SELECT user_id, count(*) AS appels, sum(cost_usd) AS cout_usd
          FROM public.ai_usage, bornes b
          WHERE created_at >= b.il_y_a_30j
          GROUP BY user_id
          ORDER BY sum(cost_usd) DESC
          LIMIT 10
        ) u
        LEFT JOIN auth.users p  ON p.id  = u.user_id
        LEFT JOIN public.profiles pr ON pr.id = u.user_id
      ) t
    ), '[]'::jsonb),

    -- ── Depense par jour, 30 derniers jours ───────────────────────
    -- Les jours sans appel sont presents a zero : une courbe qui saute
    -- les trous ment sur la tendance.
    'par_jour', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('jour', j::date, 'cout_usd', COALESCE(c.cout, 0))
                       ORDER BY j)
      FROM generate_series(date_trunc('day', now() - interval '29 days'),
                           date_trunc('day', now()), interval '1 day') j
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS jour, sum(cost_usd) AS cout
        FROM public.ai_usage
        WHERE created_at >= now() - interval '30 days'
        GROUP BY 1
      ) c ON c.jour = j
    ), '[]'::jsonb)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_ai_spend() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.get_admin_ai_spend() IS
  'Depense IA reelle agregee (totaux, par feature, par modele, top consommateurs, par jour). service_role uniquement.';
