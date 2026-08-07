# Images d'e-mail

Servies en absolu depuis `https://www.tiroir.app/emails/…`. Un e-mail ne
peut pas embarquer ses images : ni `cid:`, ni base64 (Gmail refuse le
base64 dans une balise `<img>`).

## couverture-presentation.jpg

Couverture de `marketing/emails/presentation.html`.

- **Format paysage obligatoire**, ratio 10:7. En portrait, 600 px de
  large donneraient 900 px de haut : un écran entier à franchir avant le
  premier mot.
- **1200 × 840 px**, affichée en 600 × 420 — le double pour rester nette
  sur écran dense.
- **JPEG sous 200 Ko.** Elle se télécharge sur réseau mobile, souvent
  dégradé ; au-delà, elle finit par ne plus s'afficher du tout.
### Recadrage retenu

Source portrait `Créa/image-1786114628758.webp` (1046 × 1622). Bandeau
pleine largeur, **y 514 → 1246**, centré sur la grille de fiches plutôt
que sur le téléphone : cadrer le boîtier entier aurait rendu les six
vignettes illisibles à 600 px de large, alors que ce sont elles qui
disent ce que fait le produit. L'encoche et le menton sont coupés ; les
flancs du boîtier restent dans le cadre, il se lit donc encore comme un
téléphone.

Sortie 1046 × 732 (ratio 10:7), JPEG qualité 86, 73 Ko. Servie en
1046 px pour un affichage en 600 px : 1,7× de densité, sans inventer un
seul pixel par agrandissement.

- **Pas de texte dans l'image.** Bloquée par défaut chez une bonne part
  des destinataires, tout ce qu'elle contiendrait serait perdu — et
  illisible pour un lecteur d'écran.
