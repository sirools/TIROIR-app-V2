# Vendre depuis son Tiroir — plan (décidé le 29 septembre 2026)

Décision du fondateur : la vente entre **dans la V4**, comme ce qui devait
être la V5 (pas de V6 séparée). On avance en deux étapes : **d'abord
mesurer l'envie de vendre, ensuite encaisser une commission.**

## Ce qui existe déjà (V3, en prod)

- `objects.sale_price` (prix unitaire) et `sale_price_lot` (prix d'un lot).
- Statut `sold` (vendu) dans le cycle de vie d'un objet.
- Estimation de valeur par l'IA (`estimate-value`), avec quota par formule.
- Partage par lien : le prix peut déjà s'afficher sur un partage.

## Étape 1 — « Vendre » prépare l'annonce (sans paiement, sans commission)

Un bouton **Vendre** sur la fiche d'un objet :

1. prix conseillé (estimation existante) et prix choisi → `sale_price` ;
2. annonce prête à copier : titre, description reformulée pour la vente,
   photos dans l'ordre, état, dimensions ;
3. boutons « Copier » et « Ouvrir Vinted / Leboncoin » (simple lien, aucun
   partenariat) ;
4. l'objet passe « en vente » ; à la vente, un geste le marque `sold` avec
   le prix obtenu.

**À mesurer** (page Marketing, chiffres agrégés) : combien d'objets mis en
vente, combien marqués vendus, à quel prix total. C'est ce chiffre qui dit
si l'étape 2 vaut le coût.

Rien de nouveau côté loi ni argent : Tiroir ne touche ni la vente ni le
paiement. Les objets **au coffre** ne peuvent pas être mis en vente (voir
`mode-coffre.md`).

## Étape 2 — vente et paiement dans Tiroir, avec commission

- **Paiement confié à un prestataire agréé** (Stripe Connect, ou Mangopay) :
  l'acheteur paie dans Tiroir, le prestataire garde l'argent puis le
  reverse au vendeur, **la commission de Tiroir est prélevée
  automatiquement**. Tiroir ne détient jamais l'argent des autres : pas
  d'agrément bancaire à demander.
- **Vérification d'identité des vendeurs** faite par le prestataire.
- **Stores** : pour des objets physiques, Apple et Google autorisent un
  paiement hors achat intégré — donc sans leur commission. À revérifier
  dans leurs règles au moment de coder.
- **Page de vente** publique par objet (sur le modèle des partages
  `/s/<jeton>`), avec « Acheter ».
- **Livraison** : remise en main propre d'abord ; l'envoi (étiquettes,
  suivi) plus tard.

### À trancher avant de coder l'étape 2

1. **Le taux de commission** et **qui le paie** : le vendeur (prélevé sur
   la vente) ou l'acheteur (frais de protection ajoutés au prix).
2. **L'avocat** : obligations d'une plateforme qui met en relation
   vendeurs et acheteurs (informations sur les vendeurs, particuliers ou
   professionnels, CGV, droit de rétractation quand le vendeur est un pro),
   et **déclaration des vendeurs au fisc (DAC7)**.
3. **Le prestataire** : Stripe Connect ou Mangopay (frais, pays, délais de
   versement).
4. **Litiges** : objet non conforme, non reçu — qui tranche, et comment.

## Étape 3 — place de marché publique (plus tard, avec du volume)

Recherche entre tous les Tiroirs, protection acheteur, envoi intégré,
service client. Seulement si l'étape 2 prend.

## Ordre de travail

1. Finir le mode coffre (il bloque la mise en vente des objets secrets).
2. Étape 1, web puis app ; suivi dans la page Marketing.
3. Rendez-vous avocat + choix du taux, pendant que l'étape 1 tourne.
4. Étape 2.
