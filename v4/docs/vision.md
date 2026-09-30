# Vision V4.0 — résumé

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
- Le prêt peut-il apparaître avant la V4.0 collaborative, en version minimale ?
- Comparable à étudier : Getaround (mise à disposition entre particuliers).

## La V5 se fait dans la V4 (29 septembre 2026)

Décision du fondateur : **pas de V5 séparée.** Ce qui aurait été la V5 se
construit directement dans la V4, pour n'itérer qu'une fois. Le chantier
`v5/`, qui ne contenait encore aucune décision, est refermé.

Conséquence : tout ce qu'on voulait « pour plus tard » entre ici, dans la
V4 — à consigner dans ce document et dans les fiches de Torix
(`torix/knowledge.ts`). Rien n'est encore défini pour ce périmètre
supplémentaire.

## L'assistant de Tiroir a un prénom, choisi par le client (29 septembre 2026)

Décision du fondateur : l'assistant que voient les clients de Tiroir porte
un prénom — **Nicolas** ou **Chloé** — et **c'est le client qui choisit**,
dans les réglages, avec la voix qui va avec. Rien n'est deviné : Tiroir ne
déduit jamais le genre d'un utilisateur.

- Ce n'est pas Torix : Torix reste l'IA du fondateur, invisible des
  clients. Nicolas et Chloé sont la voix de Tiroir, un personnage de
  l'app — le « personnage latent » de la direction artistique (présent
  quand il se passe quelque chose, taquin quand c'est le bazar, qui
  félicite quand on fait un effort).
- Réglage par défaut et libellés dans les quatre langues de l'app : à
  décider au moment de coder.

## Mode coffre (29 septembre 2026)

Décision du fondateur : la V4 permet de mettre un objet **au coffre** —
jamais envoyé à l'IA, jamais partagé, invisible du back-office — puis,
dans un second temps, chiffré sur le téléphone pour que même Tiroir ne
puisse pas le voir. Plan détaillé : `docs/mode-coffre.md`.

## Vendre depuis son Tiroir (29 septembre 2026)

Décision du fondateur : la vente entre **dans la V4** (pas de V6 séparée).
Étape 1 : un bouton « Vendre » prépare l'annonce, pour mesurer l'envie.
Étape 2 : vente et paiement dans Tiroir via un prestataire agréé (Stripe
Connect ou Mangopay), avec une **commission** prélevée automatiquement.
Plan détaillé : `docs/vente.md`.

## Un cycle écologique et économique (30 septembre 2026)

Décision du fondateur : le coffre garde ce qui a le plus de valeur ; le
reste circule (vendre, réinvestir, revendre). Le prix proposé par l'IA
remet en valeur la matière première et tient compte de l'usure ; gratuit
jusqu'à 20 objets. Premier outil : les contenants numérotés
(`docs/contenants.md`).
