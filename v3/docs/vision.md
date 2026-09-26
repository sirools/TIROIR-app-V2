# Vision V3 — résumé

Résumé de travail des pages Notion
[TIROIR V3](https://app.notion.com/p/3e15ccb8cef1817a90f1e4dc6ec67ff6) et
[Vision long terme — Tiroir collaboratif mobile V3+](https://app.notion.com/p/3905ccb8cef181d09288e19eff228d56)
(état au 20 septembre 2026). Notion reste la référence produit.

## L'idée

Passer de l'inventaire personnel au **partage effectif des objets** : je sais
ce que j'ai, et mes proches voient ce que je peux leur prêter. Les objets
circulent au lieu de dormir dans un tiroir.

Deux mouvements complémentaires :
- **Le Tiroir collaboratif** : plusieurs personnes travaillent sur un même
  Tiroir (le grenier de mamie, une succession, un déménagement, des assets
  d'équipe), avec statuts, commentaires, assignations et historique.
- **Le prêt** : confier un objet à une personne précise, pour une durée et un
  usage précis, et en garder la trace.

## Le trousseau de clés

Chaque objet ou chaque Tiroir possède une clé. Prêter, c'est confier une clé —
temporairement, à une personne, pour un usage. Pas de vocabulaire de
permissions côté utilisateur : on parle de clés.

## La serrure

Ce qui est ouvert, à qui, et combien de temps :

| Niveau | Sens | Existant V2 |
| --- | --- | --- |
| Fermé | Tiroir strictement privé, visible de moi seul. | Comportement actuel. |
| Entrouvert | Objets ou collections visibles par des proches choisis, avec leur disponibilité au prêt. | Rien. |
| Ouvert | Vitrine publique. | Partiellement : liens de partage (`share_links`). |

## Ce qu'il faut préserver dès maintenant

- Ne pas s'enfermer dans « un utilisateur = un tiroir strictement privé ».
- Garder la possibilité de rôles, permissions et partages fins.
- Penser l'objet comme une entité vivante : statut, historique, commentaires,
  alertes, responsabilités.

## Questions ouvertes (reprises de Notion)

- Le prêt est-il un simple statut d'objet, ou un objet de première classe avec
  son cycle de vie (demande, acceptation, retour) ?
  → Le brouillon `0002_object_loans.sql` et `domain/pret.ts` explorent la
  seconde option, sans renoncer au statut `loaned` déjà présent en V2.
- Cercle de confiance : liste de contacts, foyer, ou groupes nommés ?
  → Le brouillon `0001` part des **membres d'un Tiroir**, le plus petit pas.
- Que se passe-t-il quand un objet prêté n'est pas rendu ? Relance,
  historique, trace ?
- Le prêt peut-il apparaître avant la V3 collaborative, en version minimale ?
- Comparable à étudier : Getaround (mise à disposition entre particuliers).
