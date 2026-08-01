-- ================================================================
-- 20260801120000_object_groups.sql
-- Groupes d'objets à l'intérieur d'une collection.
--
-- Un cran de rangement sous la collection : « Vestes d'hiver » dans
-- « Dressing ». Un objet appartient à un seul groupe — au-delà, ce ne
-- sont plus des groupes mais des étiquettes, et le modèle serait tout
-- autre. Les objets sans groupe ne sont pas rassemblés dans un groupe
-- « Autres » : ils s'affichent simplement à la suite.
-- ================================================================

CREATE TABLE public.object_groups (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id UUID        NOT NULL,
  name          TEXT        NOT NULL CHECK (length(btrim(name)) > 0),
  -- Ordre d'affichage, laissé à la main de l'utilisateur plus tard ;
  -- pour l'instant l'ordre de création fait l'ordre.
  position      INTEGER     NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- FK composite : le groupe et la collection appartiennent forcément au
  -- même compte, la base le garantit plutôt que le code applicatif.
  CONSTRAINT object_groups_collection_fkey
    FOREIGN KEY (collection_id, user_id)
    REFERENCES public.collections(id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX object_groups_collection_idx ON public.object_groups (collection_id, position, created_at);
CREATE INDEX object_groups_user_idx       ON public.object_groups (user_id);

CREATE TRIGGER set_object_groups_updated_at
  BEFORE UPDATE ON public.object_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.object_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can manage groups"
  ON public.object_groups FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── Rattachement des objets ─────────────────────────────────────

ALTER TABLE public.objects
  ADD COLUMN group_id UUID NULL
    REFERENCES public.object_groups(id) ON DELETE SET NULL;

CREATE INDEX objects_group_id_idx ON public.objects (group_id) WHERE group_id IS NOT NULL;

-- ── Cohérence groupe / collection ───────────────────────────────
--
-- Un groupe appartient à une collection : un objet ne peut donc pas
-- porter le groupe d'une autre collection que la sienne. Le cas se
-- présente à chaque déplacement, et c'est le piège classique de ce
-- genre de hiérarchie — plutôt que de compter sur l'app pour y penser,
-- le déplacement détache automatiquement du groupe.

CREATE OR REPLACE FUNCTION public.objects_sync_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Changement de collection sans consigne explicite de groupe :
  -- l'ancien groupe n'a plus de sens ici.
  IF TG_OP = 'UPDATE'
     AND NEW.collection_id IS DISTINCT FROM OLD.collection_id
     AND NEW.group_id IS NOT DISTINCT FROM OLD.group_id THEN
    NEW.group_id := NULL;
  END IF;

  IF NEW.group_id IS NOT NULL THEN
    IF NEW.collection_id IS NULL THEN
      RAISE EXCEPTION 'Un objet sans collection ne peut pas appartenir à un groupe';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.object_groups g
       WHERE g.id = NEW.group_id
         AND g.collection_id = NEW.collection_id
    ) THEN
      RAISE EXCEPTION 'Le groupe n''appartient pas à la collection de l''objet';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER objects_sync_group
  BEFORE INSERT OR UPDATE OF collection_id, group_id ON public.objects
  FOR EACH ROW EXECUTE FUNCTION public.objects_sync_group();

-- ── Créer un groupe depuis une sélection ────────────────────────
--
-- Création et rattachement en une seule transaction : un groupe créé
-- puis laissé vide parce que l'affectation a échoué serait un déchet
-- que l'utilisateur devrait nettoyer à la main.

CREATE OR REPLACE FUNCTION public.create_object_group(
  p_collection_id UUID,
  p_name          TEXT,
  p_object_ids    UUID[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_group_id UUID;
  v_position INTEGER;
BEGIN
  IF length(btrim(coalesce(p_name, ''))) = 0 THEN
    RAISE EXCEPTION 'Le nom du groupe est obligatoire';
  END IF;

  SELECT coalesce(max(position), -1) + 1 INTO v_position
    FROM public.object_groups
   WHERE collection_id = p_collection_id;

  INSERT INTO public.object_groups (user_id, collection_id, name, position)
  VALUES ((SELECT auth.uid()), p_collection_id, btrim(p_name), v_position)
  RETURNING id INTO v_group_id;

  IF array_length(p_object_ids, 1) > 0 THEN
    UPDATE public.objects
       SET group_id = v_group_id
     WHERE id = ANY(p_object_ids)
       AND collection_id = p_collection_id;
  END IF;

  RETURN v_group_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_object_group(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_object_group(UUID, TEXT, UUID[]) TO authenticated;

-- ── Déplacer une sélection ──────────────────────────────────────
--
-- Collection et groupe changent ensemble : en deux requêtes, le trigger
-- ci-dessus détacherait le groupe fraîchement choisi.

CREATE OR REPLACE FUNCTION public.move_objects(
  p_object_ids    UUID[],
  p_collection_id UUID,
  p_group_id      UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.objects
     SET collection_id = p_collection_id,
         group_id      = p_group_id
   WHERE id = ANY(p_object_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.move_objects(UUID[], UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_objects(UUID[], UUID, UUID) TO authenticated;
