-- ================================================================
-- essai_sans_compte.sql (BROUILLON — à rejouer sur la preprod d'abord)
--
-- 1. profiles.user_profile : le type de profil choisi à l'onboarding
--    (« Pour moi », « Pour mon activité de créatif », « Pour mon
--    entreprise »). Il règle le ton (tu / vous), les exemples et les
--    suggestions d'offres. Il ne déclenche aucun paiement.
--
-- 2. L'essai sans compte du site (tiroir.app/essai) : un visiteur prend
--    un objet en photo, Torix l'estime, il note un emplacement, puis crée
--    son compte et l'objet le suit.
--
-- ── Pourquoi pas de compte anonyme Supabase ───────────────────────
-- Un compte anonyme porte le rôle `authenticated` : toutes les règles
-- existantes (« auth.uid() = user_id ») et tous les quotas IA gratuits
-- s'ouvriraient à qui en fabrique à la chaîne. Ici, l'essai vit dans UNE
-- table sans aucune règle d'accès : seul le serveur (clé service) la lit
-- et l'écrit, le visiteur ne tient qu'un jeton dans un cookie. Aucune
-- règle existante ne change.
--
-- ── Ce que la base garantit ───────────────────────────────────────
--   · un essai = un objet, et au plus deux tentatives d'estimation
--     (la seconde seulement si la première n'a rien donné) ;
--   · plafond par adresse IP (empreinte salée, jamais l'adresse) et
--     plafond global par jour : le coût IA d'une journée est borné ;
--   · un essai non rattaché expire (48 h par défaut) ; une inscription en
--     attente de confirmation d'e-mail le garde 7 jours ;
--   · le rattachement est atomique et rejouable : l'objet n'est créé
--     qu'une fois, pour un seul compte.
--
-- Additif, rejouable. Arrêt d'urgence, sans redéployer :
--   UPDATE public.app_settings SET trial_enabled = FALSE WHERE id = 1;
-- ================================================================

-- ── 1. Type de profil ─────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_profile TEXT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_profile_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_profile_check
  CHECK (user_profile IS NULL OR user_profile IN ('personal', 'creative', 'business'));

COMMENT ON COLUMN public.profiles.user_profile IS
  'Type de profil choisi a l onboarding : personal (tutoiement), creative ou business (vouvoiement). NULL = pas encore choisi. Ne declenche aucun paiement.';

-- Comme display_name, avatar_path et persona : le compte l'écrit lui-même.
GRANT UPDATE (user_profile) ON public.profiles TO authenticated;

-- Rattrapage : un compte qui a déjà dit son métier (profiles.persona,
-- web/lib/personas.ts) n'a pas à répondre une seconde fois. « autre »
-- reste NULL : la question lui sera posée.
UPDATE public.profiles
   SET user_profile = CASE
         WHEN persona IN ('particulier', 'collectionneur', 'famille') THEN 'personal'
         WHEN persona IN ('costumiere', 'decoratrice', 'videaste', 'photographe', 'musicien') THEN 'creative'
         WHEN persona IN ('mecano', 'artisan', 'cuisinier', 'brocanteur', 'antiquaire', 'revendeur',
                          'infirmiere_coordinatrice', 'chirurgien', 'service_hospitalier') THEN 'business'
       END
 WHERE user_profile IS NULL
   AND persona IS NOT NULL;

-- ── 2. Réglages de l'essai ────────────────────────────────────────

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS trial_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS trial_daily_cap      INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS trial_per_ip_per_day INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS trial_ttl_hours      INTEGER NOT NULL DEFAULT 48;

COMMENT ON COLUMN public.app_settings.trial_daily_cap IS
  'Essais sans compte ouverts par jour, tous visiteurs confondus : borne le cout IA d une journee.';
COMMENT ON COLUMN public.app_settings.trial_per_ip_per_day IS
  'Essais sans compte par adresse IP sur 24 h glissantes.';
COMMENT ON COLUMN public.app_settings.trial_ttl_hours IS
  'Duree de vie d un essai non rattache a un compte (objet et photo supprimes ensuite).';

-- ── 3. Les essais ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trial_objects (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Empreinte SHA-256 du jeton du cookie : le jeton lui-même n'est nulle part en base.
  token_hash        TEXT        NOT NULL UNIQUE,
  -- Empreinte du code de rattachement, qui voyage dans les métadonnées
  -- d'inscription : l'e-mail peut être confirmé sur un autre appareil.
  claim_hash        TEXT        NOT NULL UNIQUE,
  -- Empreinte salée de l'adresse IP (anti-abus). Supprimée avec la ligne.
  ip_hash           TEXT,
  locale            TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'estimated', 'claimed')),
  attempts          INTEGER     NOT NULL DEFAULT 0,
  -- Chemin dans le bucket privé trial-images.
  photo_path        TEXT,
  title             TEXT,
  category          TEXT,
  -- { value, value_min, value_max, currency, confidence, summary }
  estimate          JSONB,
  location_note     TEXT        CHECK (location_note IS NULL OR char_length(location_note) <= 200),
  model             TEXT,
  cost_usd          NUMERIC(12,6),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  signup_pending_at TIMESTAMPTZ,
  claimed_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at        TIMESTAMPTZ,
  object_id         UUID
);

CREATE INDEX IF NOT EXISTS trial_objects_ip_created_idx ON public.trial_objects (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS trial_objects_expires_idx    ON public.trial_objects (expires_at);

-- Aucune règle : ni anon ni un compte connecté ne lisent cette table.
ALTER TABLE public.trial_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trial_objects FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.trial_objects TO service_role;

COMMENT ON TABLE public.trial_objects IS
  'Essais sans compte du site (/essai). Service seulement. Lignes et photos supprimees a l expiration (trial-cleanup).';

-- Compteurs par jour, sans aucune donnée de visiteur : ils survivent au
-- nettoyage et donnent la conversion et le coût de l'essai.
CREATE TABLE IF NOT EXISTS public.trial_daily_stats (
  day       DATE          PRIMARY KEY,
  started   INTEGER       NOT NULL DEFAULT 0,
  estimated INTEGER       NOT NULL DEFAULT 0,
  claimed   INTEGER       NOT NULL DEFAULT 0,
  cost_usd  NUMERIC(12,6) NOT NULL DEFAULT 0
);

ALTER TABLE public.trial_daily_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trial_daily_stats FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.trial_daily_stats TO service_role;

-- ── 4. Ouvrir un essai : les plafonds se vérifient ici ────────────

CREATE OR REPLACE FUNCTION public.trial_start(
  p_token_hash TEXT,
  p_claim_hash TEXT,
  p_ip_hash    TEXT,
  p_locale     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
DECLARE
  v_enabled BOOLEAN;
  v_cap     INTEGER;
  v_per_ip  INTEGER;
  v_ttl     INTEGER;
  v_today   DATE := (now() AT TIME ZONE 'UTC')::date;
  v_id      UUID;
  v_expires TIMESTAMPTZ;
BEGIN
  IF coalesce(length(p_token_hash), 0) < 32 OR coalesce(length(p_claim_hash), 0) < 32
     OR coalesce(length(p_ip_hash), 0) < 16 THEN
    RAISE EXCEPTION 'trial_start: empreintes requises';
  END IF;

  -- Un seul essai s'ouvre à la fois : deux requêtes simultanées ne
  -- passent pas toutes les deux sous le plafond.
  PERFORM pg_advisory_xact_lock(hashtext('tiroir.trial_start'));

  SELECT trial_enabled, trial_daily_cap, trial_per_ip_per_day, trial_ttl_hours
    INTO v_enabled, v_cap, v_per_ip, v_ttl
    FROM public.app_settings WHERE id = 1;

  IF NOT coalesce(v_enabled, FALSE) THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'DISABLED');
  END IF;

  IF (SELECT count(*) FROM public.trial_objects
       WHERE ip_hash = p_ip_hash AND created_at > now() - interval '24 hours') >= v_per_ip THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'IP_LIMIT');
  END IF;

  IF coalesce((SELECT started FROM public.trial_daily_stats WHERE day = v_today), 0) >= v_cap THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'DAILY_CAP');
  END IF;

  v_expires := now() + make_interval(hours => v_ttl);
  INSERT INTO public.trial_objects (token_hash, claim_hash, ip_hash, locale, expires_at)
  VALUES (p_token_hash, p_claim_hash, p_ip_hash, left(p_locale, 10), v_expires)
  RETURNING id INTO v_id;

  INSERT INTO public.trial_daily_stats (day, started) VALUES (v_today, 1)
  ON CONFLICT (day) DO UPDATE SET started = public.trial_daily_stats.started + 1;

  RETURN jsonb_build_object('ok', TRUE, 'id', v_id, 'expires_at', v_expires);
END;
$fn$;

-- ── 5. Estimation : une tentative se réserve avant l'appel au modèle ─

CREATE OR REPLACE FUNCTION public.trial_begin_estimate(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
DECLARE
  v_ok BOOLEAN;
BEGIN
  -- Deux tentatives au plus, et jamais une seconde estimation réussie.
  UPDATE public.trial_objects
     SET attempts = attempts + 1
   WHERE id = p_id
     AND status = 'pending'
     AND attempts < 2
     AND expires_at > now()
  RETURNING TRUE INTO v_ok;
  RETURN coalesce(v_ok, FALSE);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trial_save_estimate(
  p_id       UUID,
  p_title    TEXT,
  p_category TEXT,
  p_estimate JSONB,
  p_model    TEXT,
  p_cost_usd NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
DECLARE
  v_ok    BOOLEAN;
  v_today DATE := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  -- p_estimate NULL : le modèle a répondu sans rien d'exploitable. Le
  -- coût est compté quand même, l'essai reste « pending ».
  IF p_estimate IS NOT NULL THEN
    UPDATE public.trial_objects
       SET status = 'estimated', title = left(p_title, 120), category = left(p_category, 60),
           estimate = p_estimate, model = p_model,
           cost_usd = coalesce(cost_usd, 0) + coalesce(p_cost_usd, 0)
     WHERE id = p_id AND status = 'pending'
    RETURNING TRUE INTO v_ok;
  ELSE
    UPDATE public.trial_objects
       SET model = p_model, cost_usd = coalesce(cost_usd, 0) + coalesce(p_cost_usd, 0)
     WHERE id = p_id;
  END IF;

  INSERT INTO public.trial_daily_stats (day, estimated, cost_usd)
  VALUES (v_today, CASE WHEN coalesce(v_ok, FALSE) THEN 1 ELSE 0 END, coalesce(p_cost_usd, 0))
  ON CONFLICT (day) DO UPDATE
    SET estimated = public.trial_daily_stats.estimated + EXCLUDED.estimated,
        cost_usd  = public.trial_daily_stats.cost_usd + EXCLUDED.cost_usd;

  RETURN coalesce(v_ok, FALSE);
END;
$fn$;

-- ── 6. Rattacher l'essai au compte ────────────────────────────────
-- Le serveur a déjà copié la photo dans object-images, au chemin donné.
-- Rejouable : un essai déjà rattaché rend l'objet créé la première fois.

CREATE OR REPLACE FUNCTION public.claim_trial_object(
  p_trial_id     UUID,
  p_user_id      UUID,
  p_object_id    UUID,
  p_image_id     UUID,
  p_storage_path TEXT,
  p_size_bytes   INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $fn$
DECLARE
  v_trial       public.trial_objects%ROWTYPE;
  v_plan        TEXT;
  v_objects_max INTEGER;
  v_objects_now INTEGER;
  v_value       NUMERIC;
  v_today       DATE := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  SELECT * INTO v_trial FROM public.trial_objects WHERE id = p_trial_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'NOT_FOUND');
  END IF;

  IF v_trial.status = 'claimed' THEN
    IF v_trial.claimed_by = p_user_id THEN
      RETURN jsonb_build_object('ok', TRUE, 'object_id', v_trial.object_id, 'already', TRUE);
    END IF;
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'CLAIMED_BY_OTHER');
  END IF;

  IF v_trial.status <> 'estimated' THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'NOT_ESTIMATED');
  END IF;

  -- Même plafond que les autres chemins de création (create_empty_object) :
  -- un compte gratuit déjà plein qui se connecte au lieu de s'inscrire.
  SELECT public.effective_plan(plan, pro_expires_at) INTO v_plan
    FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'NO_PROFILE');
  END IF;
  IF NOT public.is_paid_plan(v_plan) THEN
    SELECT free_objects_max INTO v_objects_max FROM public.app_settings WHERE id = 1;
    SELECT count(*) INTO v_objects_now FROM public.objects WHERE user_id = p_user_id;
    IF v_objects_now >= v_objects_max THEN
      RETURN jsonb_build_object('ok', FALSE, 'reason', 'OBJECT_QUOTA_EXCEEDED');
    END IF;
  END IF;

  v_value := nullif(v_trial.estimate->>'value', '')::numeric;

  INSERT INTO public.objects (
    id, user_id, title, status, location_note, attributes,
    market_value, value_currency, value_sources, value_estimated_at
  ) VALUES (
    p_object_id, p_user_id, coalesce(nullif(btrim(v_trial.title), ''), 'Mon premier objet'), 'owned',
    nullif(btrim(v_trial.location_note), ''),
    CASE WHEN nullif(btrim(v_trial.category), '') IS NULL THEN '{}'::jsonb
         ELSE jsonb_build_object('category', v_trial.category) END,
    v_value, '€',
    jsonb_build_object(
      'sources', '[]'::jsonb,
      'confidence', coalesce(v_trial.estimate->>'confidence', 'low'),
      'value_min', (v_trial.estimate->>'value_min')::numeric,
      'value_max', (v_trial.estimate->>'value_max')::numeric,
      'summary', v_trial.estimate->>'summary',
      'origin', 'trial'
    ),
    v_trial.created_at
  );

  INSERT INTO public.object_images (id, object_id, user_id, storage_path, mime_type, size_bytes, position, is_cover)
  VALUES (p_image_id, p_object_id, p_user_id, p_storage_path, 'image/jpeg', p_size_bytes, 0, TRUE);

  UPDATE public.trial_objects
     SET status = 'claimed', claimed_by = p_user_id, claimed_at = now(), object_id = p_object_id
   WHERE id = p_trial_id;

  INSERT INTO public.trial_daily_stats (day, claimed) VALUES (v_today, 1)
  ON CONFLICT (day) DO UPDATE SET claimed = public.trial_daily_stats.claimed + 1;

  RETURN jsonb_build_object('ok', TRUE, 'object_id', p_object_id, 'already', FALSE);
END;
$fn$;

-- ── 7. Nettoyage ──────────────────────────────────────────────────
-- La fonction Edge trial-cleanup lit les essais échus, supprime leurs
-- photos par l'API de stockage, puis efface les lignes. Un essai rattaché
-- est effacé de la même façon : l'objet vit désormais dans le compte.

CREATE OR REPLACE FUNCTION public.trial_expired(p_limit INTEGER DEFAULT 200)
RETURNS TABLE(id UUID, photo_path TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
  SELECT t.id, t.photo_path
    FROM public.trial_objects t
   WHERE t.expires_at < now()
   ORDER BY t.expires_at
   LIMIT greatest(1, least(coalesce(p_limit, 200), 1000));
$fn$;

DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.trial_start(TEXT, TEXT, TEXT, TEXT)',
    'public.trial_begin_estimate(UUID)',
    'public.trial_save_estimate(UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC)',
    'public.claim_trial_object(UUID, UUID, UUID, UUID, TEXT, INTEGER)',
    'public.trial_expired(INTEGER)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- ── 8. Photos d'essai : bucket privé, à part ──────────────────────
-- Aucune règle sur storage.objects pour ce bucket : seul le serveur y
-- écrit et y lit (adresses signées de courte durée).

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('trial-images', 'trial-images', FALSE, 2097152, ARRAY['image/jpeg'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ── 9. Tâche planifiée ────────────────────────────────────────────
-- Toutes les heures. L'adresse de la fonction dépend du projet (prod ou
-- preprod) : elle se lit dans le Vault, sous le nom trial_cleanup_url.
-- Tant qu'elle n'y est pas, la tâche ne fait rien. À poser une fois par
-- projet :
--   SELECT vault.create_secret(
--     'https://<ref-du-projet>.supabase.co/functions/v1/trial-cleanup',
--     'trial_cleanup_url', 'Adresse de la fonction trial-cleanup');
-- Le secret présenté est celui du cron existant (lifecycle_cron),
-- comparé en base par cron_secret_matches.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.schedule(
      'trial-cleanup',
      '43 * * * *',
      $job$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'trial_cleanup_url'),
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lifecycle_cron')
                   ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000
      )
      where exists (select 1 from vault.decrypted_secrets where name = 'trial_cleanup_url');
      $job$
    );
  END IF;
END $$;
