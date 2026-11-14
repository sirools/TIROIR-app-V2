-- Tests de essai_sans_compte.sql. Dernière ligne : nombre d'échecs (0 attendu).
CREATE TEMP TABLE r (name text, ok boolean);
GRANT ALL ON r TO PUBLIC;
\set A '''aaaaaaaa-0000-0000-0000-000000000000'''
\set B '''bbbbbbbb-0000-0000-0000-000000000000'''
\set E '''eeeeeeee-0000-0000-0000-000000000000'''
\set IP1 '''ip-1111111111111111'''
\set IP2 '''ip-2222222222222222'''
\set EST '''{"value":120,"value_min":90,"value_max":150,"currency":"€","confidence":"medium","summary":"Lampe de bureau en bon état."}'''

-- ── Type de profil ────────────────────────────────────────────────
INSERT INTO r SELECT 'rattrapage : maison → personal', user_profile = 'personal' FROM public.profiles WHERE id = :A;
INSERT INTO r SELECT 'rattrapage : création → creative', user_profile = 'creative' FROM public.profiles WHERE id = :B;
INSERT INTO r SELECT 'rattrapage : commerce → business', user_profile = 'business' FROM public.profiles WHERE id = 'cccccccc-0000-0000-0000-000000000000';
INSERT INTO r SELECT 'rattrapage : « autre » reste à demander', user_profile IS NULL FROM public.profiles WHERE id = 'dddddddd-0000-0000-0000-000000000000';
INSERT INTO r SELECT 'rattrapage : sans métier, NULL', user_profile IS NULL FROM public.profiles WHERE id = :E;

DO $$ BEGIN
  UPDATE public.profiles SET user_profile = 'vip' WHERE id = 'eeeeeeee-0000-0000-0000-000000000000';
  INSERT INTO r VALUES ('profil : valeur inconnue refusée', FALSE);
EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('profil : valeur inconnue refusée', TRUE);
END $$;

SET ROLE authenticated;
UPDATE public.profiles SET user_profile = 'creative' WHERE id = :E;
RESET ROLE;
INSERT INTO r SELECT 'profil : le compte l’écrit lui-même', user_profile = 'creative' FROM public.profiles WHERE id = :E;

-- ── Accès : service seulement ─────────────────────────────────────
INSERT INTO r SELECT 'essais : anon ne lit pas', NOT has_table_privilege('anon', 'public.trial_objects', 'SELECT');
INSERT INTO r SELECT 'essais : un compte ne lit pas', NOT has_table_privilege('authenticated', 'public.trial_objects', 'SELECT');
INSERT INTO r SELECT 'essais : un compte n’écrit pas', NOT has_table_privilege('authenticated', 'public.trial_objects', 'INSERT');
INSERT INTO r SELECT 'compteurs : un compte ne lit pas', NOT has_table_privilege('authenticated', 'public.trial_daily_stats', 'SELECT');
INSERT INTO r SELECT 'trial_start : fermé à anon', NOT has_function_privilege('anon', 'public.trial_start(text,text,text,text)', 'EXECUTE');
INSERT INTO r SELECT 'claim : fermé aux comptes', NOT has_function_privilege('authenticated', 'public.claim_trial_object(uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE');
INSERT INTO r SELECT 'claim : ouvert au service', has_function_privilege('service_role', 'public.claim_trial_object(uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE');
INSERT INTO r SELECT 'estimation : fermée aux comptes', NOT has_function_privilege('authenticated', 'public.trial_begin_estimate(uuid)', 'EXECUTE');
INSERT INTO r SELECT 'RLS active', relrowsecurity FROM pg_class WHERE oid = 'public.trial_objects'::regclass;

-- ── Ouvrir un essai, plafond par IP ───────────────────────────────
CREATE TEMP TABLE s AS SELECT public.trial_start(repeat('a', 64), repeat('1', 64), :IP1, 'fr') AS j;
INSERT INTO r SELECT 'ouverture : acceptée', (j->>'ok')::boolean FROM s;
INSERT INTO r SELECT 'ouverture : expire dans 48 h', (j->>'expires_at')::timestamptz BETWEEN now() + interval '47 hours' AND now() + interval '49 hours' FROM s;
SELECT public.trial_start(repeat('b', 64), repeat('2', 64), :IP1) \g /dev/null
SELECT public.trial_start(repeat('c', 64), repeat('3', 64), :IP1) \g /dev/null
INSERT INTO r SELECT 'plafond par IP : le 4e est refusé', public.trial_start(repeat('d', 64), repeat('4', 64), :IP1)->>'reason' = 'IP_LIMIT';
INSERT INTO r SELECT 'plafond par IP : une autre adresse passe', (public.trial_start(repeat('e', 64), repeat('5', 64), :IP2)->>'ok')::boolean;
INSERT INTO r SELECT 'compteur du jour : 4 ouvertures', started = 4 FROM public.trial_daily_stats;

DO $$ BEGIN
  PERFORM public.trial_start('court', repeat('6', 64), 'ip-3333333333333333');
  INSERT INTO r VALUES ('ouverture : empreinte trop courte refusée', FALSE);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('ouverture : empreinte trop courte refusée', TRUE);
END $$;

-- ── Plafond du jour, arrêt d'urgence ──────────────────────────────
UPDATE public.app_settings SET trial_daily_cap = 4;
INSERT INTO r SELECT 'plafond du jour : refus', public.trial_start(repeat('f', 64), repeat('7', 64), 'ip-4444444444444444')->>'reason' = 'DAILY_CAP';
UPDATE public.app_settings SET trial_daily_cap = 300, trial_enabled = FALSE;
INSERT INTO r SELECT 'arrêt d’urgence : refus', public.trial_start(repeat('f', 64), repeat('7', 64), 'ip-4444444444444444')->>'reason' = 'DISABLED';
UPDATE public.app_settings SET trial_enabled = TRUE;

-- ── Estimation : deux tentatives, une seule réussite ──────────────
CREATE TEMP TABLE t1 AS SELECT id FROM public.trial_objects WHERE token_hash = repeat('a', 64);
INSERT INTO r SELECT 'estimation : 1re tentative réservée', public.trial_begin_estimate(id) FROM t1;
-- Le modèle n'a rien rendu d'exploitable : coût compté, essai toujours ouvert.
INSERT INTO r SELECT 'estimation ratée : pas de résultat', NOT public.trial_save_estimate(id, NULL, NULL, NULL, 'claude-haiku-4-5', 0.002) FROM t1;
INSERT INTO r SELECT 'estimation ratée : reste pending', status = 'pending' FROM public.trial_objects WHERE id = (SELECT id FROM t1);
INSERT INTO r SELECT 'estimation : 2e tentative réservée', public.trial_begin_estimate(id) FROM t1;
INSERT INTO r SELECT 'estimation : enregistrée', public.trial_save_estimate(id, 'Lampe de bureau', 'Luminaire', :EST::jsonb, 'claude-haiku-4-5', 0.003) FROM t1;
INSERT INTO r SELECT 'estimation : pas de 3e tentative', NOT public.trial_begin_estimate(id) FROM t1;
INSERT INTO r SELECT 'estimation : pas d’écrasement', NOT public.trial_save_estimate(id, 'Autre', NULL, :EST::jsonb, 'x', 0) FROM t1;
INSERT INTO r SELECT 'estimation : titre gardé, coût cumulé', title = 'Lampe de bureau' AND cost_usd = 0.005 FROM public.trial_objects WHERE id = (SELECT id FROM t1);
INSERT INTO r SELECT 'compteur du jour : 1 estimation, coût 0,005', estimated = 1 AND cost_usd = 0.005 FROM public.trial_daily_stats;

-- Essai échu : aucune tentative.
UPDATE public.trial_objects SET expires_at = now() - interval '1 minute' WHERE token_hash = repeat('b', 64);
INSERT INTO r SELECT 'estimation : essai échu refusé', NOT public.trial_begin_estimate(id) FROM public.trial_objects WHERE token_hash = repeat('b', 64);

-- ── Rattachement ──────────────────────────────────────────────────
UPDATE public.trial_objects SET location_note = '  tiroir du bureau ' WHERE id = (SELECT id FROM t1);

-- Pas encore estimé : rien à rattacher.
INSERT INTO r SELECT 'rattachement : essai non estimé refusé',
  public.claim_trial_object(id, :A, gen_random_uuid(), gen_random_uuid(), 'x/y/z.jpg')->>'reason' = 'NOT_ESTIMATED'
  FROM public.trial_objects WHERE token_hash = repeat('c', 64);
INSERT INTO r SELECT 'rattachement : essai inconnu', public.claim_trial_object(gen_random_uuid(), :A, gen_random_uuid(), gen_random_uuid(), 'x/y/z.jpg')->>'reason' = 'NOT_FOUND';

CREATE TEMP TABLE c AS
  SELECT public.claim_trial_object(id, :A, '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
    'aaaaaaaa-0000-0000-0000-000000000000/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg', 12345) AS j FROM t1;
INSERT INTO r SELECT 'rattachement : accepté', (j->>'ok')::boolean AND NOT (j->>'already')::boolean FROM c;
INSERT INTO r SELECT 'objet : au compte, titre, emplacement nettoyé',
  user_id = :A AND title = 'Lampe de bureau' AND location_note = 'tiroir du bureau' AND status = 'owned'
  FROM public.objects WHERE id = '11111111-1111-1111-1111-111111111111';
INSERT INTO r SELECT 'objet : estimation et fourchette',
  market_value = 120 AND value_currency = '€' AND (value_sources->>'value_min')::numeric = 90
  AND (value_sources->>'value_max')::numeric = 150 AND value_sources->>'origin' = 'trial' AND value_estimated_at IS NOT NULL
  FROM public.objects WHERE id = '11111111-1111-1111-1111-111111111111';
INSERT INTO r SELECT 'objet : catégorie en caractéristique', attributes->>'category' = 'Luminaire' FROM public.objects WHERE id = '11111111-1111-1111-1111-111111111111';
INSERT INTO r SELECT 'photo : couverture de l’objet', is_cover AND mime_type = 'image/jpeg' AND size_bytes = 12345
  FROM public.object_images WHERE object_id = '11111111-1111-1111-1111-111111111111';
INSERT INTO r SELECT 'essai : marqué rattaché', status = 'claimed' AND claimed_by = :A AND object_id = '11111111-1111-1111-1111-111111111111'
  FROM public.trial_objects WHERE id = (SELECT id FROM t1);

-- Rejoué (double clic, retour arrière) : même objet, rien de créé.
INSERT INTO r SELECT 'rattachement rejoué : même objet',
  (j->>'already')::boolean AND j->>'object_id' = '11111111-1111-1111-1111-111111111111'
  FROM (SELECT public.claim_trial_object(id, :A, gen_random_uuid(), gen_random_uuid(), 'a/b/c.jpg') AS j FROM t1) x;
INSERT INTO r SELECT 'rattachement rejoué : un seul objet', count(*) = 1 FROM public.objects WHERE user_id = :A;
INSERT INTO r SELECT 'rattachement : un autre compte est refusé',
  public.claim_trial_object(id, :B, gen_random_uuid(), gen_random_uuid(), 'b/b/c.jpg')->>'reason' = 'CLAIMED_BY_OTHER' FROM t1;
INSERT INTO r SELECT 'compteur du jour : 1 rattachement', claimed = 1 FROM public.trial_daily_stats;

-- Compte gratuit déjà plein : refus propre, l'essai reste rattachable.
CREATE TEMP TABLE t5 AS SELECT id FROM public.trial_objects WHERE token_hash = repeat('e', 64);
SELECT public.trial_begin_estimate(id) FROM t5 \g /dev/null
SELECT public.trial_save_estimate(id, '', NULL, '{"value":10,"value_min":5,"value_max":15}'::jsonb, 'claude-haiku-4-5', 0.001) FROM t5 \g /dev/null
UPDATE public.app_settings SET free_objects_max = 0;
INSERT INTO r SELECT 'compte plein : refus',
  public.claim_trial_object(id, :B, gen_random_uuid(), gen_random_uuid(), 'b/1/1.jpg')->>'reason' = 'OBJECT_QUOTA_EXCEEDED' FROM t5;
INSERT INTO r SELECT 'compte plein : essai intact', status = 'estimated' FROM public.trial_objects WHERE id = (SELECT id FROM t5);
UPDATE public.profiles SET plan = 'premium' WHERE id = :B;
INSERT INTO r SELECT 'compte payant : pas de plafond',
  (public.claim_trial_object(id, :B, '33333333-3333-3333-3333-333333333333', gen_random_uuid(), 'b/3/1.jpg')->>'ok')::boolean FROM t5;
INSERT INTO r SELECT 'objet sans titre : titre par défaut, sans catégorie', title = 'Mon premier objet' AND attributes = '{}'::jsonb
  FROM public.objects WHERE id = '33333333-3333-3333-3333-333333333333';
UPDATE public.app_settings SET free_objects_max = 30;

-- ── Nettoyage ─────────────────────────────────────────────────────
INSERT INTO r SELECT 'nettoyage : seuls les essais échus', count(*) = 1 AND bool_and(id = (SELECT id FROM public.trial_objects WHERE token_hash = repeat('b', 64)))
  FROM public.trial_expired(50);
-- Compte supprimé : l'essai rattaché ne bloque pas la suppression.
DELETE FROM auth.users WHERE id = :A;
INSERT INTO r SELECT 'compte supprimé : essai détaché', claimed_by IS NULL FROM public.trial_objects WHERE id = (SELECT id FROM t1);

SELECT name AS "ÉCHEC" FROM r WHERE ok IS NOT TRUE;
SELECT count(*) AS total FROM r;
SELECT count(*) FILTER (WHERE ok IS NOT TRUE) AS echecs FROM r;
