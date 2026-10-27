-- Tests de profiles_locale.sql. Dernière ligne : nombre d'échecs (0 attendu).
CREATE TEMP TABLE r (name text, ok boolean);

INSERT INTO r SELECT 'rattrapage : langue connue recopiée', locale = 'de' FROM public.profiles WHERE id = '11111111-0000-0000-0000-000000000000';
INSERT INTO r SELECT 'rattrapage : sans langue, NULL', locale IS NULL FROM public.profiles WHERE id = '22222222-0000-0000-0000-000000000000';

INSERT INTO auth.users VALUES ('33333333-0000-0000-0000-000000000000', 'c@x.fr', '{"locale":"da","display_name":"Ole"}');
INSERT INTO r SELECT 'inscription : langue du site', locale = 'da' AND display_name = 'Ole' FROM public.profiles WHERE id = '33333333-0000-0000-0000-000000000000';
INSERT INTO r SELECT 'inscription : tiroir et journal créés', (SELECT count(*) FROM public.drawers WHERE user_id = '33333333-0000-0000-0000-000000000000') = 1 AND (SELECT count(*) FROM public.activity_log WHERE user_id = '33333333-0000-0000-0000-000000000000') = 1;

INSERT INTO auth.users VALUES ('44444444-0000-0000-0000-000000000000', 'd@x.fr', '{"locale":"es-ES"}');
INSERT INTO r SELECT 'inscription : langue régionale ramenée', locale = 'es' FROM public.profiles WHERE id = '44444444-0000-0000-0000-000000000000';

INSERT INTO auth.users VALUES ('55555555-0000-0000-0000-000000000000', 'e@x.fr', '{"locale":"it"}');
INSERT INTO r SELECT 'inscription : langue inconnue → NULL', locale IS NULL FROM public.profiles WHERE id = '55555555-0000-0000-0000-000000000000';

-- Portugais : la variante est gardée (app V4).
INSERT INTO auth.users VALUES ('66666666-0000-0000-0000-000000000000', 'f@x.fr', '{"locale":"pt-BR"}');
INSERT INTO r SELECT 'inscription : pt-BR gardé', locale = 'pt-BR' FROM public.profiles WHERE id = '66666666-0000-0000-0000-000000000000';
INSERT INTO auth.users VALUES ('77777777-0000-0000-0000-000000000000', 'g@x.fr', '{"locale":"pt_PT"}');
INSERT INTO r SELECT 'inscription : pt_PT → pt-PT', locale = 'pt-PT' FROM public.profiles WHERE id = '77777777-0000-0000-0000-000000000000';
INSERT INTO auth.users VALUES ('88888888-0000-0000-0000-000000000000', 'h@x.fr', '{"locale":"pt"}');
INSERT INTO r SELECT 'inscription : pt seul → pt-BR', locale = 'pt-BR' FROM public.profiles WHERE id = '88888888-0000-0000-0000-000000000000';

-- Compte Google : la langue arrive après coup.
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"locale":"en"}' WHERE id = '22222222-0000-0000-0000-000000000000';
INSERT INTO r SELECT 'mise à jour : langue rattachée', locale = 'en' FROM public.profiles WHERE id = '22222222-0000-0000-0000-000000000000';

-- Réglages de l'app : changement de langue.
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"locale":"fr"}' WHERE id = '33333333-0000-0000-0000-000000000000';
INSERT INTO r SELECT 'mise à jour : changement suivi', locale = 'fr' FROM public.profiles WHERE id = '33333333-0000-0000-0000-000000000000';

-- Langue illisible : la langue connue reste.
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"locale":"xx"}' WHERE id = '33333333-0000-0000-0000-000000000000';
INSERT INTO r SELECT 'mise à jour : langue illisible ignorée', locale = 'fr' FROM public.profiles WHERE id = '33333333-0000-0000-0000-000000000000';

-- Autre métadonnée modifiée : rien ne bouge.
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"acq":{"source":"x"}}' WHERE id = '11111111-0000-0000-0000-000000000000';
INSERT INTO r SELECT 'mise à jour : autre champ sans effet', locale = 'de' FROM public.profiles WHERE id = '11111111-0000-0000-0000-000000000000';

DO $$ BEGIN
  BEGIN UPDATE public.profiles SET locale = 'it' WHERE id = '11111111-0000-0000-0000-000000000000';
    INSERT INTO r VALUES ('contrainte : langue hors liste refusée', false);
  EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('contrainte : langue hors liste refusée', true);
  END;
END $$;

SELECT name, ok FROM r ORDER BY ok, name;
SELECT count(*) FILTER (WHERE NOT ok OR ok IS NULL) FROM r;
