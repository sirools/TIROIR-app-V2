# Brief V4 — bloc Valeur, statuts et mise en vente

Reformulé le 29 septembre 2026 à partir du brief du fondateur, qui est
arrivé coupé après le point 1. Les points 2 et 3 sont des **propositions à
valider**, tirées des décisions déjà prises (`vente.md`, `mode-coffre.md`).

## Contexte

- La V4 garde la base de la V3, va à l'essentiel et simplifie la lecture
  de la valeur.
- **Un seul dépôt : `sirools/TIROIR-app-V2`**. Il porte le site web
  (`web/`, déployé par Vercel) et l'app native iOS et Android
  (`mobile/`, Expo). Les anciens dépôts (`TIROIR-web`, `TIROIR-app`,
  `tiroir2`) sont archivés.
- Configuration GitHub inchangée. Travail sur une branche dédiée,
  fusionnée dans `main` seulement après validation du fondateur.
- Chaque point se fait **sur le web et dans l'app**, avec les mêmes
  libellés (quatre langues dans l'app).

## 1. Fiche objet : hiérarchie du bloc Valeur ✅ fait

- Le **prix de vente définitif** s'affiche en premier, en haut du bloc.
  Pour un lot, le total du lot (remise comprise) l'accompagne.
- En dessous, une carte dépliable **« Détail de la valeur »** contient
  l'estimation du propriétaire, la valeur marchande de l'IA (fourchette,
  confiance, sources) et le prix et la date d'achat.
- Au dépliage, la carte **pousse le contenu vers le bas dans le flux**,
  sans panneau en surimpression. Repliée par défaut.
- Sans prix de vente, l'en-tête garde l'estimation, comme avant.
- La caution reste visible hors du détail : elle sert au prêt.

Où : `mobile/app/(app)/objects/[id].tsx` (`ValeurCard`) et
`web/pages/s/[token]/[objectId].tsx` (fiche d'un objet partagé).

## 2. Statuts — proposition à valider

Aujourd'hui : possédé, en stockage, prêté, vendu, donné, perdu. La V4
ajoute ce qui manque pour vendre, prêter et entretenir :

| Statut | Sens | Nouveau ? |
| --- | --- | --- |
| Possédé | Chez moi | existant |
| **En vente** | Prix fixé, annonce prête | nouveau |
| Prêté | Chez quelqu'un, avec date de retour | existant |
| **En entretien** | Chez un artisan | nouveau |
| Vendu, donné, perdu | Sorti du Tiroir, garde son historique | existant |
| **Au coffre** | Jamais envoyé à l'IA, jamais partagé | nouveau (voir `mode-coffre.md`) |

À valider : « En stockage » fusionne-t-il avec « Possédé » pour aller à
l'essentiel ?

## 3. Mise en vente — proposition à valider

Étape 1 de `vente.md` : un bouton **« Vendre »** sur la fiche.
1. Prix conseillé (estimation existante), puis prix choisi : il devient le
   prix de vente affiché en tête du bloc Valeur.
2. Annonce prête à copier : titre, description, photos, état.
3. L'objet passe « En vente ». À la vente, un geste le marque « Vendu »
   avec le prix obtenu.
4. Un objet au coffre ne peut pas être mis en vente.

Le prototype de fiche de vente vit déjà sur le web :
`/s/<jeton>/<objet>/vente`.
