# Motion V3 Ulule — montage After Effects

Vidéo de lancement Ulule, 55 s, 16:9, 25 i/s, plus une version carrée.

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `motion-v3.jsx` | Script After Effects : construit tout le montage |
| `manifest.json` | Scènes, plans vidéo, temps, captures à incruster, musique, rendus |
| `textes.json` | Titres, sous-titres, bulles du dialogue, signature |
| `assets/logo_tiroir.png` | Logo, tiré de `web/public/logo-tiroir.svg` |

À déposer dans ce même dossier :

- les dix plans `P01_chaos.mp4` … `P10_trois_telephones.mp4` (à la racine, ou dans `veo/`) ;
- `musique.wav` ;
- les captures de l'app dans `ecrans/`, nommées comme dans `manifest.json` (`01_capture_photo.png` … `10_accueil.png`) ;
- facultatif : `assets/flamme_bleue.png` (PNG transparent).

## Lancer

Dans After Effects : Fichier > Scripts > Exécuter le fichier de script…, choisir `motion-v3.jsx`.

Le script crée un dossier « MOTION V3 — Ulule » dans le projet : une composition par scène,
`MOTION_V3_55s`, `MOTION_V3_carre_1080`, et deux éléments dans la file de rendu (sorties dans `rendus/`).
Il finit par la liste des fichiers qu'il n'a pas trouvés.

## Incruster les captures

Chaque plan a, dans la composition de sa scène, un calque masqué `ECRAN_Pxx [à suivre : Quatre coins]`.
C'est une précomposition au format téléphone (1170 × 2532) qui contient déjà les captures du plan,
enchaînées, avec l'effet Quatre coins posé dessus. Suivre l'écran vert du plan, coller les quatre
coins sur l'effet, puis réactiver le calque. Le plan reste à 100 % dans sa composition : le zoom
lent est appliqué sur la scène, dans la composition principale, pour ne pas fausser le suivi.

## Caler la musique

Le calque `musique` porte un marqueur `DROP`, la composition un marqueur `SIGNATURE` (51 s).
Déplacer `DROP` sur le vrai drop de la musique, puis relancer le script et répondre « Oui » :
la musique glisse pour que le drop tombe sur la signature. Pour changer l'instant de la
signature, déplacer le marqueur `SIGNATURE` avant de relancer.

## Modifier les textes ou les temps

Tout se règle dans `textes.json` et `manifest.json`, puis on relance le script dans un projet vide.
Les temps des sous-titres sont en secondes dans la vidéo ; ceux des bulles sont en secondes depuis
le début de leur scène. `entree` est l'instant du plan source où commence l'extrait utilisé.
