# Landing — sections « Pour les créatifs » et « Pour les professionnels »

Branche `feat/landing-creatifs-pro`. Les deux sections arrivent après « Une
photo, c'est tout » et **remplacent « Pour les créatifs et les pros »**
(personas en tu), qui visait le même public.

## Décisions du fondateur (2026-11-08)

- **Les fonctions des offres sont annoncées comme à venir.** L'app (4.1
  comprise) n'a pas encore de courbe de valeur, de bouton Actualiser, de
  sources, d'export assurance, d'estimation en lot ni de crédits inclus en
  Pro. La page Tarifs les présente comme « formules à venir », avec des
  boutons « Bientôt disponible ». Les sections suivent donc ce choix :
  badge « Bientôt » ou « Offres à venir », verbes au futur, et des CTA qui
  mènent à la page Tarifs (« Découvrir Premium », « Découvrir l'offre Pro »)
  au lieu de « Passer au Premium » et « Passer au Pro ».
- **Pas de « Un mois offert sur l'abonnement annuel ».** La page Tarifs
  affiche Premium à 15 €/mois ou 180 €/an (12 × 15), et Pro seulement à
  l'année. La mention reviendra en même temps qu'un changement de prix.
- **Le portugais du Brésil est ouvert sur le site**, pour la homepage
  seulement (`/pt`) ; les autres pages en portugais renvoient vers
  l'anglais. « Você » partout, registre formel sur les offres payantes.

## Écarts avec le brief, pour rester ISO

- **Pro, « sans quota », « sans limite »** : la page Tarifs dit « IA
  incluse, sans recharge ». Le texte devient « Les crédits IA seront inclus
  dans votre forfait, sans recharge à prévoir ». Le titre « Estimation sans
  limite » devient « IA incluse », et « sans limite » est retiré du
  sous-titre.
- **Business, « suivi administratif clair »** : rien sur la page Tarifs ni
  dans l'app ne le décrit. Le texte reprend ce que la page Tarifs annonce :
  « facturation mensuelle sur facture, par virement ou prélèvement ».
- **Partage** : seule la lecture seule est mentionnée, rien sur le mot de
  passe.

## À fournir ou à valider

1. **Contact Business** : validé le 2026-11-08. Le bouton « Nous contacter »
   ouvre un e-mail à clement.ougier@gmail.com avec l'objet « Tiroir
   Business » (`BUSINESS_CONTACT` dans `ProBusiness.tsx`). La section
   n'affiche ni l'adresse e-mail ni d'adresse postale. La page Tarifs garde
   son propre lien vers hello@tiroir.app : à aligner si ce doit être la
   même adresse partout.
2. **Visuel de la section créatifs** : une fiche avec la photo
   `public/screens/chain/appareil-photo.png` (un appareil argentique, sans
   marque visible), une estimation fictive (420 – 510 €) et une courbe
   dessinée en SVG. Visuel définitif à fournir : une photo de caméra ou
   d'objectif professionnel, carrée, fond neutre, sans logo de fabricant.
3. **Visuel de la section Pro** : un aperçu d'export assurance construit en
   HTML, avec quatre objets fictifs et des données marquées « fictives ». À
   remplacer par une capture de l'export réel quand il existera.
4. **Textes à relire** :
   - es et de : nouvelles sections traduites par un agent.
   - pt-BR : toute la landing traduite par un agent ; une relecture native
     est indispensable avant de mettre l'adresse en avant.
5. **Quand les offres sortiront** : retirer les badges, repasser les verbes
   au présent et remettre « Passer au Premium » et « Passer au Pro », dans
   les cinq langues.

## Repéré en passant, hors de ce brief

- **Section « La valeur de vos objets »** (`home.value`, en tu) : le point
  « Suivre » présente la valeur actualisée et une courbe comme disponibles,
  alors que l'app ne les a pas encore. Même écart ISO que ci-dessus.
- **Résumé des tarifs de la landing** (`PricingFaq`) : il affiche les prix
  de `OFFERS_V4` (Premium 4,99 €/mois), alors que la page Tarifs affiche
  ses propres prix « à venir » (Premium dès 15 €/mois). Les deux se
  contredisent.
