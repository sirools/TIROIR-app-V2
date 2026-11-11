# Visuels de la page Ulule — campagne Tiroir

**Statut : à valider par Clément. Ne rien publier ni partager avant.**

Source modifiable : fichier Figma léger (clé `r1Z1rSRohAE6lTxDB2DCQw`),
page « Ulule — Visuels campagne ». Les fichiers d'ici sont les exports de
cette page. On corrige dans Figma, puis on ré-exporte.

| # | Visuel | Accroche | Exports |
| --- | --- | --- | --- |
| 1 | Photo d'un objet | Une photo, et c'est rangé. | `1-photo-*` |
| 2 | Fiche objet et estimation de valeur | Tu sais enfin ce que ça vaut. | `2-fiche-objet-*` |
| 3 | Collection d'un vidéaste freelance | Tout ton matériel, bien rangé. | `3-collection-*` |
| 4 | Partage protégé par mot de passe | Partage ta liste, protégée par mot de passe. | `4-partage-*` |
| 5 | Teaser : orbite Tiroir–Torix | Tiroir ne tourne plus seul. | `5-teaser-orbite-*` (GIF en boucle et image fixe) |

Formats : `*-ulule-1240x930` pour la page Ulule, `*-carre-1080` pour les
réseaux. Les deux GIF pèsent environ 300 Ko (60 images, 4 s, en boucle).

## Ce qui a servi

- **Écrans** : redessinés d'après le code de l'app. Couleurs et police
  viennent de `design/tokens.json`. Les libellés de l'interface sont ceux
  de `fr.json`.
  - Visuel 1 : `capture/index.tsx`.
  - Visuel 2 : `objects/[id].tsx`, dont le bloc « Estimation Torix » et la
    fiche « Valeur marché ».
  - Visuel 3 : `collections/[id].tsx`.
  - Visuel 4 : `SharePanel.tsx` et `app/s/[token].tsx`.
- **Bleu Bitanium** (`#1C2E9E`, style du fichier Figma) : l'orbite autour
  du téléphone et Torix dans le teaser.
- **Orbite** : reprise du motif « Système Tiroir–Torix » du t-shirt Ulule.
  Le GIF est généré par un script (Inter, mêmes couleurs).
- **Données de démo** : uniquement des objets, prix et noms fictifs. Les
  photos d'objets ont été générées par IA dans Figma, sans marque ni logo.
  Aucune donnée d'utilisateur.

## Écarts avec l'app, à trancher

1. **Visuel 1** : Tiroir n'a pas de viseur à lui. « Prendre une photo »
   ouvre l'appareil photo du téléphone. Le téléphone montre donc un viseur
   neutre, et l'encart à côté montre le vrai écran Tiroir « Prends une
   photo ».
2. **Visuel 3** : l'écran Collection n'affiche pas de total. Le total
   (4 830 €) est dans un encart marketing posé à côté du téléphone. Dans
   l'app, il n'existe que sur le Profil, sous « valeur estimée ».
3. **Visuel 4** : l'en-tête de la vue destinataire affiche « TiROiR »,
   comme dans l'app.
