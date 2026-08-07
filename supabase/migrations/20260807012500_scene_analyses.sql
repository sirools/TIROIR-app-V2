-- ================================================================
-- 20260807012500_scene_analyses.sql
-- scene_analyses : une analyse de scene, conservee.
--
-- Jusqu'ici la scene ne survivait pas a l'ecran. ai_usage garde le cout et
-- le nombre d'objets, jamais le resultat ni la photo : impossible de
-- retrouver une analyse abandonnee, alors que c'est precisement le cas a
-- rattraper — l'utilisateur photographie un placard, se fait interrompre,
-- et devrait pouvoir reprendre sans repayer une analyse.
--
-- Ce n'est pas qu'un confort : donner une identite persistante a la scene
-- est aussi ce qui rend son fichier stockable. La policy INSERT du bucket
-- object-images n'accepte un chemin que s'il est adosse a une ligne qui
-- appartient a l'utilisateur ({uid}/{object_id}/ ou {uid}/drafts/{draft_id}/).
-- Un chemin {uid}/scenes/... sans ligne correspondante etait rejete — c'est
-- l'erreur RLS observee a la creation du lot.
--
-- Ecriture reservee au service_role : c'est detect-scene qui ecrit, au
-- moment ou il a deja l'image et le resultat en main. Le client n'uploade
-- rien, donc aucune policy Storage n'est a assouplir.
--
-- RETENTION : les scenes jamais confirmees (objects_created = 0) s'accumulent.
-- La purge n'est PAS automatisee ici : supprimer la ligne laisserait le
-- fichier orphelin dans le bucket (le stockage ne s'efface pas en SQL). Elle
-- viendra par une tache qui appelle l'API Storage. En attendant, l'utilisateur
-- peut supprimer une entree depuis l'historique — ligne et fichier ensemble.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.scene_analyses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- {uid}/scenes/{id}.jpg — NULL si le stockage a echoue : une analyse
  -- reussie ne doit pas etre perdue parce que sa photo n'a pas pu etre ecrite.
  storage_path    TEXT,
  mime_type       TEXT        NOT NULL DEFAULT 'image/jpeg'
                              CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/heic')),

  model           TEXT        NOT NULL,
  input_tokens    INTEGER     NOT NULL DEFAULT 0,
  output_tokens   INTEGER     NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(12,6),
  duration_ms     INTEGER,

  -- Sortie brute du modele, telle quelle. Rejouer une analyse depuis
  -- l'historique doit rendre exactement ce que l'utilisateur avait vu.
  result          JSONB       NOT NULL,
  object_count    INTEGER     NOT NULL DEFAULT 0,
  truncated       BOOLEAN     NOT NULL DEFAULT false,

  -- Suite donnee a l'analyse. Cumulatif : une meme scene peut servir deux
  -- fois, on ne cree pas forcement tout le lot du premier coup.
  objects_created INTEGER     NOT NULL DEFAULT 0,
  confirmed_at    TIMESTAMPTZ,
  collection_id   UUID        REFERENCES public.collections(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scene_analyses_user_created_idx
  ON public.scene_analyses (user_id, created_at DESC);

ALTER TABLE public.scene_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads own scenes" ON public.scene_analyses;
CREATE POLICY "owner reads own scenes"
  ON public.scene_analyses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Suppression laissee au proprietaire : l'historique est a lui, et une
-- photo de placard doit pouvoir disparaitre sur demande.
DROP POLICY IF EXISTS "owner deletes own scenes" ON public.scene_analyses;
CREATE POLICY "owner deletes own scenes"
  ON public.scene_analyses FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT/UPDATE : service_role et SECURITY DEFINER uniquement. Le compteur
-- objects_created est une mesure, pas une declaration du client.
REVOKE INSERT, UPDATE ON public.scene_analyses FROM anon, authenticated;

COMMENT ON TABLE public.scene_analyses IS
  'Historique des analyses de scene : photo, resultat brut, cout, suite donnee. Ecrite par detect-scene en service_role.';
COMMENT ON COLUMN public.scene_analyses.objects_created IS
  'Cumulatif : une scene peut alimenter plusieurs creations successives.';
