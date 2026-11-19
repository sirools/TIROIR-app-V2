-- Retire au rôle anon (et à PUBLIC) le droit d'exécuter 11 fonctions
-- SECURITY DEFINER du schéma public, signalées par le linter Supabase (règle 0028).
--
-- Aucune n'a besoin d'un appel sans connexion :
--   - 7 exigent auth.uid() dès leur première ligne ;
--   - 3 sont des fonctions de trigger ou d'event trigger, jamais appelées en
--     RPC (le droit EXECUTE n'est vérifié qu'à la création du trigger, pas
--     quand il se déclenche) ;
--   - increment_share_view est appelée par le serveur du site avec la clé
--     service (web/pages/s/[token].tsx), pas par le navigateur du visiteur.
--
-- Pourquoi REVOKE FROM PUBLIC ne suffisait pas : à la création d'une fonction
-- dans public, Supabase donne EXECUTE à anon explicitement, par ses privilèges
-- par défaut. Il faut donc nommer anon. Et PUBLIC aussi, car les 3 fonctions de
-- trigger l'ont encore.
--
-- authenticated et service_role gardent leur droit explicite : rien ne change
-- pour un utilisateur connecté ni pour les Edge Functions.
--
-- Boucle sur les noms plutôt que REVOKE signature par signature :
-- rls_auto_enable est posée par Supabase et absente de ces migrations, et ce
-- dossier doit pouvoir se rejouer sur une base vierge.

DO $$
DECLARE
  v_names CONSTANT text[] := ARRAY[
    'check_and_increment_photo_enhance_quota',
    'enforce_collection_ceiling',
    'get_ai_quota',
    'get_photo_enhance_quota',
    'get_plan_limits',
    'increment_share_view',
    'log_client_event',
    'log_object_created',
    'patch_insurance',
    'patch_object',
    'rls_auto_enable'
  ];
  v_fn regprocedure;
  v_left text;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY (v_names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_fn);
  END LOOP;

  -- Filet : un droit resté (hérité d'un autre rôle, par exemple) annule tout.
  SELECT string_agg(p.oid::regprocedure::text, ', ')
    INTO v_left
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = ANY (v_names)
     AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION 'anon peut encore exécuter : %', v_left;
  END IF;
END;
$$;
