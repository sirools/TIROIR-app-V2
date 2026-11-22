# Le sous-sol englouti — prototype Vision Pro

Prototype visionOS du niveau 1 : un enfant retrouve 5 enceintes cachées
dans un sous-sol inondé, en maquette posée sur une table, avec une lampe
torche et le son spatial. Torix sert de guide vocal.

Il sert à tester une seule question : la mécanique lampe + son spatial
donne-t-elle envie d'explorer, sans surcharger ?

> **État : écrit sans Xcode, jamais compilé.** Le code a été rédigé dans un
> environnement Linux sans compilateur Swift. Le plan du niveau et les
> scénarios des tests ont été vérifiés avec un script Node, mais le premier
> lancement dans Xcode peut demander quelques corrections de compilation.

## Lancer

Il faut un Mac avec Xcode 16 ou plus récent et le SDK visionOS (2.0 minimum).

1. Ouvrir `SousSolEnglouti.xcodeproj`.
2. Choisir la destination **Apple Vision Pro** (simulateur) et lancer (⌘R).
3. La fenêtre des règles s'ouvre. « Jouer » ouvre la maquette en volume :
   la placer sur une table, la regarder de haut.

Sur le casque : dans la cible `SousSolEnglouti`, onglet *Signing &
Capabilities*, choisir son équipe ; jumeler le Vision Pro (Réglages →
Général → Appareils distants), puis le choisir comme destination.

Les règles du jeu se testent sans casque ni simulateur :

```bash
swift test
```

## Comment on joue

- Regarder une pastille bleu clair à côté du Messager et pincer : il y va.
  Une case à la fois, jamais à travers un mur.
- La lampe éclaire la case du Messager et ses 8 voisines (rayon 1,5 case).
- 4 piles, 6 cases par pile. Une borne verte recharge tout. Lampe vide :
  le Messager s'efface et réapparaît à la dernière borne (ou à l'escalier),
  piles pleines, sans aucun message.
- Chaque enceinte joue sa mélodie, plus fort quand le Messager approche.
  Passer dessus, ou la pincer quand elle est éclairée, la fait sortir de
  l'eau.
- Torix parle au départ, après 30 s sans déplacement, à chaque enceinte et
  à la fin. Ses phrases s'affichent aussi en toutes lettres.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `Sources/Jeu/` | Les règles, sans RealityKit : labyrinthe, niveau, piles, indices de Torix. |
| `Tests/JeuTests/` | Les tests des règles (`swift test`). |
| `SousSolEnglouti/` | L'app : maquette 3D (`Scene/`), son et voix (`Son/`), écrans (`Vues/`). |
| `SousSolEnglouti/Ressources/` | Les sons. |
| `outils/` | `plan.mjs` (plan du niveau), `sons.py` (mélodies temporaires). |

Les nombres à régler après un essai sont dans `Sources/Jeu/Reglages.swift`.

## Le plan du niveau

Le plan est figé dans `Sources/Jeu/Niveau.swift`, en ASCII lisible. Il sort
de `outils/plan.mjs` : backtracking récursif, 13 × 9, graine 20261119.

**À vérifier contre Figma.** Le fichier Figma n'était pas accessible : le
générateur aléatoire utilisé là-bas n'étant pas connu, rien ne garantit que
ce plan soit le même, ni que les enceintes et les bornes soient aux mêmes
cases. Si le plan diffère, coller celui de Figma dans `planNiveau1` : rien
d'autre n'est à changer (le test « plan figé = graine » est alors à retirer).

Avec 24 cases d'autonomie, ce labyrinthe aux longs couloirs ne se parcourt
pas en entier. Les enceintes et les bornes ont donc été placées pour que
tout soit faisable : chaque enceinte est à un aller-retour d'une borne, et
le parcours complet demande environ 92 pas. Conséquence : le quart nord-est
(l'Atelier) n'a pas d'enceinte et reste hors de portée de la lampe.

## Sons et voix

- **Mélodies** : `enceinte_1.wav` … `enceinte_5.wav` sont temporaires
  (`python3 outils/sons.py`). Pour les remplacer, garder les mêmes noms, en
  **mono** (obligatoire pour le son spatial), en boucles de même durée.
- **Torix** : sans fichier, la voix française du casque dit la phrase.
  Pour une vraie voix, ajouter dans `Ressources/` un fichier par phrase,
  `torix_<nom>.m4a` : `depart`, `trouvee1` à `trouvee4`, `fin`,
  `resonneDroite`, `resonneGauche`, `resonneFond`, `resonneDevant`,
  `toutPres`, `borneProche`. Les textes sont dans `Sources/Jeu/Torix.swift`.

Aucun appel réseau.

## Choix techniques

- **Regard** : les apps n'ont pas accès à la position du regard. visionOS
  met en évidence ce qui est regardé (`HoverEffectComponent`) et transmet
  le pincement (`SpatialTapGesture`). Cela suffit : pas de suivi des mains,
  pas d'ARKit, aucune autorisation demandée.
- **Volume** (`.windowStyle(.volumetric)`), pas de mode immersif.
- **Obscurité** : matériaux non éclairés dont la teinte suit l'éclairage du
  jeu, en fondu. La lumière de la pièce n'y change rien.
- **Maquette générée en code** à partir de la grille (pas de Reality
  Composer Pro).

## Accessibilité

Pas de chrono, de score ni d'échec ; aucun son d'erreur. Aucun flash ni
clignotement : lumière, volume et apparitions changent toujours en fondu.
Volume plafonné et réglable. Bleus et crème, avec deux seules couleurs
vives (jaune des enceintes, vert des bornes). Règles en pictogrammes avant
de jouer. Bouton Pause toujours visible, qui fige tout et baisse le son ;
la pause se met aussi seule quand la maquette passe à l'arrière-plan.

Deux écarts au brief, choisis pour le calme, à valider à l'essai :

- les cases déjà éclairées gardent une trace très sombre, pour ne pas se
  perdre (`souvenir` dans `SceneMaquette.swift` ; mettre la valeur de
  `noir` pour revenir au noir complet) ;
- marcher sur une enceinte suffit à la trouver, sans avoir à la pincer.

Le port du casque par un enfant se fait sous la surveillance d'un adulte,
en respectant les âges minimums indiqués par Apple.
