-- ================================================================
-- 20260807080000_assistant_feature_flag.sql
-- L'assistant repasse derriere un drapeau, et devient mesurable.
--
-- Il etait ouvert a tous les comptes 'premium' alors qu'il est encore en
-- developpement : pas assez fiable pour etre un argument de vente. Il
-- redevient donc une fonctionnalite d'admin, ouvrable par changement de
-- config le jour ou il sera pret — pas par une release App Store.
--
-- Au passage, il portait la meme erreur de plan que la retouche photo :
-- `plan <> 'premium'` refusait l'assistant aux comptes 'pro', pourtant
-- superieurs. Le drapeau la remplace et la question ne se pose plus.
--
-- C'etait aussi la derniere fonction IA sans compteur ET sans mesure. Le
-- compteur est JOURNALIER et non mensuel : une conversation est une
-- rafale, pas une consommation reguliere. Un plafond mensuel se viderait
-- en un apres-midi, un plafond journalier borne l'emballement sans jamais
-- gener un usage normal.
-- ================================================================

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS assistant_audience TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS assistant_daily_messages INTEGER NOT NULL DEFAULT 50;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_assistant_audience_valid;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_assistant_audience_valid
  CHECK (assistant_audience IN ('admin', 'pro', 'premium', 'all'));

COMMENT ON COLUMN public.app_settings.assistant_audience IS
  'Qui accede a l assistant : admin (defaut, en developpement), pro, premium, all.';
COMMENT ON COLUMN public.app_settings.assistant_daily_messages IS
  'Plafond de messages par jour et par compte. Journalier : une conversation est une rafale.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assistant_messages_today INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assistant_quota_day      DATE    NOT NULL DEFAULT CURRENT_DATE;

-- ── L'arbitrage d'audience, une seule fois ────────────────────────
-- Recopie par drapeau, cette regle finirait par diverger d'un drapeau a
-- l'autre sans que personne ne le remarque.

CREATE OR REPLACE FUNCTION public.audience_allows(
  p_audience TEXT, p_plan TEXT, p_admin BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE COALESCE(p_audience, 'admin')
    WHEN 'all'     THEN TRUE
    WHEN 'premium' THEN COALESCE(p_admin, FALSE) OR p_plan IN ('premium', 'pro')
    WHEN 'pro'     THEN COALESCE(p_admin, FALSE) OR p_plan = 'pro'
    ELSE COALESCE(p_admin, FALSE)
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.audience_allows(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audience_allows(TEXT, TEXT, BOOLEAN) TO authenticated;

-- ── Les drapeaux rendent maintenant deux booleens ─────────────────
-- Un seul appel cote client, l'arbitrage reste en base : ouvrir une
-- fonctionnalite ne doit jamais demander de redeployer l'application.
--
-- La signature change (colonne ajoutee au resultat) : il faut remplacer
-- la fonction, pas la reecrire. Atomique, et le contrat client reste un
-- sur-ensemble — l'app deja deployee lit multi_add par son nom.

DROP FUNCTION IF EXISTS public.get_feature_flags();

CREATE FUNCTION public.get_feature_flags()
RETURNS TABLE(multi_add BOOLEAN, assistant BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_multi     TEXT;
  v_assistant TEXT;
  v_plan      TEXT;
  v_admin     BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT s.multi_add_audience, s.assistant_audience
    INTO v_multi, v_assistant
    FROM public.app_settings s WHERE s.id = 1;

  SELECT p.plan, p.is_admin INTO v_plan, v_admin
    FROM public.profiles p WHERE p.id = auth.uid();

  RETURN QUERY SELECT
    public.audience_allows(v_multi, v_plan, v_admin),
    public.audience_allows(v_assistant, v_plan, v_admin);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_feature_flags() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_feature_flags() TO authenticated;

-- ── Acces + plafond journalier, en un appel ───────────────────────
-- Retourne 'OK' | 'NOT_ALLOWED' | 'QUOTA_EXCEEDED'.

CREATE OR REPLACE FUNCTION public.check_and_increment_assistant_quota()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_audience TEXT;
  v_limit    INTEGER;
  v_plan     TEXT;
  v_admin    BOOLEAN;
  v_used     INTEGER;
  v_day      DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT s.assistant_audience, s.assistant_daily_messages
    INTO v_audience, v_limit
    FROM public.app_settings s WHERE s.id = 1;

  SELECT p.plan, p.is_admin, p.assistant_messages_today, p.assistant_quota_day
    INTO v_plan, v_admin, v_used, v_day
    FROM public.profiles p WHERE p.id = auth.uid();

  IF NOT public.audience_allows(v_audience, v_plan, v_admin) THEN
    RETURN 'NOT_ALLOWED';
  END IF;

  IF v_day < CURRENT_DATE THEN
    UPDATE public.profiles
       SET assistant_messages_today = 0, assistant_quota_day = CURRENT_DATE
     WHERE id = auth.uid();
    v_used := 0;
  END IF;

  IF v_used >= COALESCE(v_limit, 50) THEN
    INSERT INTO public.activity_log (user_id, action, payload)
    VALUES (auth.uid(), 'assistant.quota_exceeded',
            jsonb_build_object('used', v_used, 'quota', v_limit));
    RETURN 'QUOTA_EXCEEDED';
  END IF;

  UPDATE public.profiles
     SET assistant_messages_today = assistant_messages_today + 1,
         assistant_quota_day      = CURRENT_DATE
   WHERE id = auth.uid();

  RETURN 'OK';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_assistant_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_assistant_quota() TO authenticated;
