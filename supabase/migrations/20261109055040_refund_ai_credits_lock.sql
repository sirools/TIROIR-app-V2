-- ================================================================
-- refund_ai_credits_lock.sql — SCRIPT FINAL (créé le 08/11/2026, session
-- « Tunnel d'achat Tiroir avec Stripe » ; finalisé le 09/11/2026 après
-- l'audit Stripe / stores). Un REVOKE, sans DROP, rejouable, aucune
-- donnée modifiée. À n'appliquer qu'avec l'accord de Clément.
--
-- Trou : refund_ai_credits(p_consume_id) était appelable par le compte
-- connecté. Un compte pouvait dépenser des crédits, recevoir le résultat
-- de l'IA, puis se rendre lui-même ces crédits (l'identifiant de la
-- dépense est lisible dans son journal) : IA payante gratuite.
-- Depuis ai_credits_spend (en prod le 08/11/2026), le seul remboursement
-- est refund_ai_spend, réservé au serveur.
--
-- Appelants vérifiés le 09/11/2026 : aucun. Ni l'app, ni le site, ni les
-- Edge Functions (main, toutes les branches, versions déployées), ni
-- aucune fonction SQL de la prod. Le journal des crédits de la prod ne
-- contient aucun remboursement : le trou n'a pas servi.
--
-- Effet : les comptes (authenticated), anon et PUBLIC perdent le droit
-- d'exécution ; service_role et postgres le gardent. La fonction reste
-- en place (rien ne la supprime).
--
-- Droits avant (prod, 09/11/2026) :
--   {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- Retour arrière : rollback/refund_ai_credits_lock.rollback.sql.
-- Tests : tests/refund_ai_credits_lock.test.sql (tests/run.sh).
-- ================================================================
DO $$
BEGIN
  IF to_regprocedure('public.refund_ai_credits(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.refund_ai_credits(UUID) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
