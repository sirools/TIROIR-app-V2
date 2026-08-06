-- ================================================================
-- 20260806185511_object_quantity.sql
-- objects.quantity : nombre d'exemplaires indiscernables sur une fiche.
--
-- « 6 chaises identiques » = UNE fiche avec quantity = 6, pas six fiches.
-- La frontière avec les groupes d'objets est nette : un groupe rassemble
-- des objets DIFFÉRENTS qui vont ensemble (« Vestes d'hiver ») et n'est
-- créé que par l'utilisateur ; la quantité couvre des objets identiques.
--
-- RÈGLE D'OR — tous les montants de la table restent UNITAIRES.
-- market_value, user_value, sale_price, deposit_amount, purchase_price et
-- insurance_coverage gardent leur sens actuel : la valeur d'UN exemplaire.
-- Le total d'un lot est TOUJOURS dérivé (valeur × quantity), jamais stocké.
-- Stocker le total désynchroniserait chaque somme de collection à la
-- première modification de quantité.
--
-- Non-régression : DEFAULT 1 donne à tout l'existant la valeur qu'il avait
-- déjà implicitement. Aucune ligne ne change de sens, aucun calcul actuel
-- ne bouge. Sous PostgreSQL 11+, un DEFAULT constant ne réécrit pas la
-- table — l'opération est instantanée quelle que soit sa taille.
-- ================================================================

ALTER TABLE public.objects
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- Une fiche décrit au moins un exemplaire : quantity = 0 voudrait dire
-- « objet que je ne possède pas », ce qui relève du statut, pas du compte.
ALTER TABLE public.objects
  DROP CONSTRAINT IF EXISTS objects_quantity_positive;

ALTER TABLE public.objects
  ADD CONSTRAINT objects_quantity_positive CHECK (quantity >= 1);

COMMENT ON COLUMN public.objects.quantity IS
  'Nombre d''exemplaires identiques. Les montants de la table restent unitaires ; le total du lot est dérivé, jamais stocké.';
