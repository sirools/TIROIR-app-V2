-- Retour arrière de refund_ai_credits_lock.sql : remet les droits relevés
-- en prod le 09/11/2026 juste avant le script :
--   {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- (définition de la fonction inchangée par le script, md5
-- 8806da0cbf3e6a4afff5e01c7ad7d365). ROUVRE LE TROU : à n'exécuter que si
-- un appelant oublié casse après le REVOKE, le temps de le corriger.
GRANT EXECUTE ON FUNCTION public.refund_ai_credits(UUID) TO authenticated;
