-- ================================================================
-- 20260723005303_discard_draft.sql
-- Écarte un draft sans le confirmer (bouton « supprimer » d'une
-- ligne dans l'écran de review d'un lot).
--
-- Le client ne peut pas écrire sur ai_drafts (RLS en SELECT seul) :
-- il lui faut cette RPC. Le statut 'rejected' est déjà prévu par la
-- contrainte CHECK de la table.
--
-- confirm_batch() ne confirme que les drafts en 'pending' : un draft
-- écarté est donc simplement ignoré à la validation du lot.
-- ================================================================

CREATE OR REPLACE FUNCTION public.discard_draft(p_draft_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_found BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  UPDATE public.ai_drafts
     SET status     = 'rejected',
         updated_at = now()
   WHERE id      = p_draft_id
     AND user_id = auth.uid()
     AND status IN ('uploading', 'pending');

  v_found := FOUND;

  -- Les photos du draft écarté n'ont plus de raison d'être : leur
  -- ligne part ici, le fichier Storage sera purgé avec les drafts
  -- expirés (pas de purge automatique à ce jour).
  IF v_found THEN
    DELETE FROM public.ai_draft_images
     WHERE draft_id = p_draft_id AND user_id = auth.uid();
  END IF;

  RETURN v_found;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.discard_draft(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.discard_draft(UUID) TO authenticated;
