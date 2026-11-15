# Motion V3 Ulule — prompts Veo

Un prompt par plan pour la vidéo de lancement Ulule (55 s, 16:9, 25 i/s).
Les plans sont générés en 3D réaliste avec Veo ; les vraies captures de
Tiroir sont incrustées ensuite dans After Effects, sur l'écran vert du
téléphone.

Storyboard et fiches personnages : fichier Figma `r1Z1rSRohAE6lTxDB2DCQw`,
page « Motion V3 — Ulule » (frames `S01_chaos` … `S07_signature`, frame
`_personnages`).

## Découpage (55 s)

| Scène | Temps | Plans | Voix off ou dialogue |
| --- | --- | --- | --- |
| S01_chaos | 0–4 s | P01 | « Vos infos sont partout. » |
| S02_logo | 4–8 s | logo dans After Effects, puis P02 | « Tiroir : une photo par objet, et c'est rangé. » |
| S03_reparateur | 8–18 s | P03, P04 | « Dans ces enceintes dorment des trésors. Torix les reconnaît et estime leur valeur. » |
| S04_styliste | 18–28 s | P05, P06 | « Une proposition impeccable, validée en un coup d'œil. » |
| S05_videaste | 28–36 s | P07 | « Son matériel, ses devis, partagés en confiance. » (« ses devis » reste à trancher : Tiroir n'a pas de fonction de devis) |
| S06b_dialogue | 36–46 s | P08, P09 | Réparateur : « Mes pièces, c'était des cartons et des post-it. » Styliste : « Moi, des photos perdues dans trois messageries. » Vidéaste : « Et moi, un tableur que personne ne lit. » Tous : « Maintenant, c'est dans Tiroir. » |
| S06_trois_ecrans | 46–51 s | P10 | « Trois métiers. Une seule app. » |
| S07_signature | 51–55 s | aucun plan Veo : signature, logo et bouton dans After Effects | « Tiroir. Tout ce qui compte, dans une seule app. Soutenez-nous sur Ulule. » |

Chaque plan est généré entre 5 et 8 s. Quand la scène est plus courte, le
plan est coupé au montage (colonne « Utilisé » de chaque fiche).

## Captures à fournir

Les numéros servent dans chaque plan. Captures prises sur téléphone, en
portrait, sans vrai nom, sans visage, sans marque lisible.

| N° | Écran de Tiroir | Contenu attendu |
| --- | --- | --- |
| 1 | Capture photo | Une enceinte vintage dans le viseur |
| 2 | Analyse Torix ou relecture | Objet reconnu et classé |
| 3 | Fiche objet avec estimation Torix | Valeur et fourchette visibles |
| 4 | Collection en grille | Pièces de stylisme |
| 5 | Page de partage vue par le destinataire | La collection n° 4, ouverte dans le navigateur d'un téléphone |
| 6 | Collection avec valeur totale | Matériel caméra |
| 7 | Création du lien avec mot de passe | Option de protection activée |
| 8 | Page « Partage protégé » | Saisie du mot de passe, dans le navigateur d'un téléphone |
| 9 | Collection du réparateur | Enceintes et pièces |
| 10 | Accueil de l'app | Les trois collections ensemble si possible |

## Règles communes à tous les plans

Le bloc ci-dessous se colle à la fin de chaque prompt. Les prompts sont en
anglais, langue dans laquelle Veo suit le mieux les consignes.

```text
Photorealistic 3D render, cinematic, 16:9, 25 fps, shallow depth of field, natural skin and materials.
The character is entirely fictional and must not resemble any real person, actor or public figure.
The smartphone is a generic black slab with thin bezels and no logo. Its screen is a perfectly flat,
uniform, pure chroma green (#00FF00), evenly lit, matte, with no reflections, no glare, no interface,
no text and no icons. The whole screen and its four corners stay fully visible for the entire shot:
no finger, object or frame edge ever covers it. The screen faces the camera, tilted no more than
20 degrees, and fills at least one fifth of the frame height. The phone moves slowly and smoothly,
with no motion blur on the screen.
No brand names, no logos, no readable text or lettering anywhere in the image. No watermark, no subtitles.
Hands have five fingers, natural proportions. No music, no speech; soft ambient room sound only.
```

Rappels pour la génération :

- **Références** : joindre l'export de la fiche du personnage (frame
  `fiche_…` dans `_personnages`) comme image de référence quand l'outil le
  permet. Elle fixe le costume, la silhouette et les couleurs ; le rendu
  reste réaliste, pas dessiné.
- **Continuité** : reprendre mot pour mot la description du personnage d'un
  plan à l'autre, et réutiliser la même image de référence.
- **Vert dans le costume** : le manteau de la styliste et le sweat du
  vidéaste sont verts. L'écran se remplace par suivi des quatre coins
  (incrustation en perspective), pas par une clé chromatique sur toute
  l'image. Si un plan demande quand même une clé, régénérer ce plan avec un
  écran bleu uni (`pure chroma blue (#0000FF)`).
- **Contrôle avant montage** : rejeter tout plan avec un doigt sur l'écran,
  un coin d'écran hors cadre, un texte ou un logo apparu, une main
  déformée, ou un visage qui évoque une personne connue.

Descriptions à reprendre telles quelles :

```text
REPAIRER: a sturdy man in his fifties with short grey-brown hair and a short grey-brown beard, white shirt
with sleeves rolled up above the elbows, plain orange workshop apron with one chest pocket, dark grey
trousers, strong craftsman's hands.
STYLIST: a tall, slender woman in her thirties with dark hair tied in a high bun, small round orange
earrings, a long deep-green coat over a white collar, an orange tailor's measuring tape draped around her
neck, orange flat shoes.
VIDEOGRAPHER: a man in his late twenties wearing a plain orange beanie, a sage-green hooded sweatshirt,
black trousers and black backpack straps over his shoulders.
```

---

## P01 — Le chaos (S01)

- **Durée** : générer 6 s. **Utilisé** : 0–4 s.
- **Décor** : un bureau encombré vu de près : feuilles imprimées de tableaux sans texte lisible, tirages photo d'objets en vrac, notes adhésives jaunes vierges, cartons ouverts.
- **Lumière** : lumière de bureau froide et plate, un peu terne.
- **Caméra** : travelling avant lent au-dessus du bureau, légère plongée.
- **Action** : des mains posent encore des feuilles et des photos sur la pile ; le téléphone est posé au milieu, écran vers le haut.
- **Personnage de référence** : aucun (mains seules, sans visage).
- **Captures à incruster** : aucune. Remplir l'écran en noir (téléphone éteint) : la scène montre l'avant Tiroir.

```text
Close top-down shot of a cluttered office desk: printed spreadsheet pages with blurred, unreadable grids,
loose photo prints of everyday objects, blank yellow sticky notes, two open cardboard boxes. A pair of
hands keeps dropping more sheets and photo prints onto the pile. A smartphone lies flat in the middle of
the desk, screen up. Cold, flat, slightly dull office light. Slow dolly-in from above, slight high angle.
[common rules]
```

## P02 — Une photo, et c'est rangé (S02)

- **Durée** : générer 5 s. **Utilisé** : 6–8 s (le logo occupe 4–6 s dans After Effects).
- **Décor** : une table en bois clair, fond beige chaud uni.
- **Lumière** : douce, chaude, diffuse, ombres légères.
- **Caméra** : plan fixe, très léger travelling avant.
- **Action** : une main tient le téléphone au-dessus d'un petit objet (une lampe de bureau ancienne) comme pour le photographier, puis l'autre main dépose l'objet dans un tiroir en bois ouvert, qui se referme doucement.
- **Personnage de référence** : aucun (mains seules).
- **Captures à incruster** : n° 1 (capture photo), avec un objet proche de celui du plan.

```text
A light wooden table against a plain warm beige background. One hand holds a smartphone above a small
vintage desk lamp as if taking a picture of it, the phone screen facing the camera. The other hand then
places the lamp into an open wooden drawer, which slides gently shut. Soft, warm, diffused light with
light shadows. Static shot with a very slight push-in.
[common rules]
```

## P03 — Le réparateur photographie une enceinte (S03)

- **Durée** : générer 5 s. **Utilisé** : 8–13 s.
- **Décor** : atelier chaleureux, établi en bois, outils rangés au mur, deux enceintes vintage en bois avec haut-parleurs apparents, sans marque.
- **Lumière** : dorée, de fin d'après-midi, par une fenêtre latérale ; poussière en suspension.
- **Caméra** : gros plan sur les mains, travelling latéral lent de gauche à droite.
- **Action** : le réparateur essuie le dessus d'une enceinte, puis lève le téléphone devant elle pour la photographier ; l'écran est tourné vers la caméra.
- **Personnage de référence** : `fiche_reparateur`.
- **Captures à incruster** : n° 1 (capture photo).

```text
A warm repair workshop: a wooden workbench, tools neatly hung on the wall, two unbranded vintage wooden
loudspeakers with exposed speaker cones. REPAIRER wipes the top of one loudspeaker with a cloth, then
raises a smartphone in front of it to photograph it, the phone screen facing the camera. Close-up on his
hands and forearms, his face soft in the background. Golden late-afternoon light from a side window, dust
floating in the air. Slow lateral tracking shot from left to right.
[REPAIRER description] [common rules]
```

## P04 — Torix reconnaît et estime (S03)

- **Durée** : générer 5 s. **Utilisé** : 13–18 s.
- **Décor** : le même atelier, l'enceinte en arrière-plan flou.
- **Lumière** : la même lumière dorée, visage éclairé de côté.
- **Caméra** : plan poitrine, travelling avant lent vers le téléphone.
- **Action** : le réparateur tient le téléphone à hauteur de poitrine, écran vers la caméra ; il le regarde, hausse les sourcils puis sourit, agréablement surpris.
- **Personnage de référence** : `fiche_reparateur` (expressions « surprise » puis « joie »).
- **Captures à incruster** : n° 2 (objet reconnu), puis n° 3 (fiche avec estimation), enchaînées dans After Effects.

```text
The same warm repair workshop, a vintage wooden loudspeaker blurred in the background. REPAIRER holds a
smartphone at chest height with its screen facing the camera. He looks down at it, raises his eyebrows in
pleasant surprise, then smiles. Medium close-up from the chest up. Golden side light on his face. Slow
push-in towards the phone.
[REPAIRER description] [common rules]
```

## P05 — La styliste et son portant (S04)

- **Durée** : générer 5 s. **Utilisé** : 18–23 s.
- **Décor** : studio clair et épuré, murs blancs, sol en béton ciré, un portant noir avec quelques vêtements espacés (vert sauge, orange, écru, noir), sans étiquette.
- **Lumière** : grande lumière douce et diffuse, haute, presque sans ombre.
- **Caméra** : plan large, travelling arrière très lent, rythme posé.
- **Action** : la styliste ajuste un vêtement sur le portant, recule d'un pas, puis lève le téléphone à hauteur d'épaule, écran vers la caméra.
- **Personnage de référence** : `fiche_styliste`.
- **Captures à incruster** : n° 4 (collection en grille).

```text
A bright, minimalist fashion studio: white walls, polished concrete floor, a black clothes rail holding a
few well-spaced garments in sage green, orange, off-white and black, with no labels. STYLIST adjusts a
garment on the rail, takes one step back, then raises a smartphone to shoulder height with its screen
facing the camera. Large, soft, diffused high-key light with almost no shadows. Wide shot, very slow
pull-back, calm and elegant pace.
[STYLIST description] [common rules]
```

## P06 — La production valide (S04)

- **Durée** : générer 5 s. **Utilisé** : 23–28 s.
- **Décor** : un bureau de production clair : table blanche, carnet fermé, tasse unie, un portant flou au fond.
- **Lumière** : douce et claire, cohérente avec P05.
- **Caméra** : plan rapproché par-dessus l'épaule, quasi fixe, léger travelling avant.
- **Action** : une personne de dos, dont on ne voit que l'épaule et les mains, tient le téléphone par les bords, écran vers la caméra ; elle hoche légèrement la tête en signe d'approbation.
- **Personnage de référence** : aucun (personne de dos, sans visage).
- **Captures à incruster** : n° 5 (page de partage vue par le destinataire).

```text
A bright production office: a white table, a closed notebook, a plain cup, a clothes rail blurred in the
background. Over-the-shoulder close shot of a person seen from behind, only one shoulder and both hands
visible, never the face. They hold a smartphone by its edges with the screen facing the camera, and give
a slight approving nod. Soft, clear, high-key light. Almost static shot with a slight push-in.
[common rules]
```

## P07 — Le vidéaste et son matériel (S05)

- **Durée** : générer 8 s. **Utilisé** : 28–36 s.
- **Décor** : un plateau de tournage sombre : table noire, caméra sans marque, deux objectifs, un trépied replié, un sac à dos ouvert.
- **Lumière** : froide, bleutée, contrastée, un contre-jour léger.
- **Caméra** : mouvement plus vif que les autres plans : arc rapide autour de la table, qui se stabilise sur le téléphone pendant les quatre dernières secondes.
- **Action** : le vidéaste range un objectif dans le sac, saisit le téléphone et le présente à la caméra, écran de face, immobile jusqu'à la fin du plan.
- **Personnage de référence** : `fiche_videaste`.
- **Captures à incruster** : n° 6 (collection avec valeur totale), puis n° 7 (création du lien avec mot de passe), puis n° 8 (« Partage protégé »), enchaînées sur la partie stable du plan.

```text
A dark film set: a black table with an unbranded cinema camera, two lenses, a folded tripod and an open
backpack. VIDEOGRAPHER puts a lens into the backpack, picks up a smartphone and presents it to the
camera, screen facing forward, then holds it perfectly still until the end of the shot. Cool, bluish,
contrasted light with a soft rim light. Energetic camera: a quick arc around the table that settles into
a steady frame on the phone for the last four seconds.
[VIDEOGRAPHER description] [common rules]
```

## P08 — Le dialogue (S06b)

- **Durée** : générer 8 s. **Utilisé** : 36–43 s.
- **Décor** : un fond de studio beige chaud uni, sol assorti ; les trois personnages debout côte à côte, face caméra.
- **Lumière** : douce, chaude, uniforme sur les trois.
- **Caméra** : plan américain fixe, très léger travelling avant ; les trois personnages tiennent dans le carré central de l'image (pour la version 1:1), avec de l'espace vide au-dessus des têtes pour les bulles.
- **Action** : chacun réagit à tour de rôle, de gauche à droite : le réparateur hausse les épaules, la styliste lève les yeux au ciel, le vidéaste secoue la tête en souriant. Bouches fermées : le texte est porté par les bulles, ajoutées dans After Effects. Chacun tient son téléphone le long du corps, écran vers la caméra.
- **Personnage de référence** : `fiche_reparateur`, `fiche_styliste`, `fiche_videaste` (dans cet ordre, de gauche à droite).
- **Captures à incruster** : aucune. Remplir les trois écrans en noir (téléphones éteints) : on parle encore de l'avant.

```text
A plain warm beige studio backdrop with a matching floor. Three people stand side by side facing the
camera, all three within the central square of the frame, with empty space above their heads. From left
to right: REPAIRER, STYLIST, VIDEOGRAPHER. One after the other, from left to right, each reacts without
speaking, mouths closed: the repairer shrugs, the stylist rolls her eyes, the videographer shakes his
head with a smile. Each holds a smartphone down at their side with the screen facing the camera. Soft,
warm, even light on all three. Static medium-long shot with a very slight push-in.
[REPAIRER description] [STYLIST description] [VIDEOGRAPHER description] [common rules]
```

## P09 — « Maintenant, c'est dans Tiroir. » (S06b)

- **Durée** : générer 5 s. **Utilisé** : 43–46 s.
- **Décor** : le même fond beige, les trois personnages aux mêmes places.
- **Lumière** : la même, un peu plus lumineuse.
- **Caméra** : même cadre que P08, fixe.
- **Action** : les trois lèvent leur téléphone en même temps à hauteur de poitrine, écran vers la caméra, et sourient. Bouches fermées.
- **Personnage de référence** : les trois fiches (expression « joie »).
- **Captures à incruster** : n° 9 (réparateur), n° 4 (styliste), n° 6 (vidéaste).

```text
The same plain warm beige studio backdrop, the same three people in the same positions, from left to
right: REPAIRER, STYLIST, VIDEOGRAPHER. All three raise their smartphones to chest height at the same
time, screens facing the camera, and smile, mouths closed. The three screens are level and do not overlap.
Soft, warm, even light, slightly brighter. Static medium-long shot, same framing as the previous shot.
[REPAIRER description] [STYLIST description] [VIDEOGRAPHER description] [common rules]
```

## P10 — Trois métiers, une seule app (S06)

- **Durée** : générer 5 s. **Utilisé** : 46–51 s.
- **Décor** : une table en bois clair vue de dessus, fond beige ; un tournevis à manche orange, un mètre ruban orange et un objectif sans marque posés aux bords du cadre.
- **Lumière** : douce et chaude, zénithale.
- **Caméra** : plongée verticale fixe, très lent travelling avant.
- **Action** : trois mains posent trois téléphones à plat, côte à côte, écrans vers le haut, puis les font glisser jusqu'à ce qu'ils se touchent au centre. Les mains se retirent complètement.
- **Personnage de référence** : aucun (mains seules : manche blanche retroussée, manche vert profond, manche vert sauge).
- **Captures à incruster** : n° 9, n° 4 et n° 6 sur les trois écrans, puis n° 10 (accueil) quand ils se rejoignent, fondu dans After Effects.

```text
Top-down view of a light wooden table on a warm beige background. An orange-handled screwdriver, an
orange tailor's measuring tape and an unbranded camera lens rest near the edges of the frame. Three hands
enter from three sides, one with a rolled-up white sleeve, one with a deep-green sleeve, one with a
sage-green sleeve, and each lays a smartphone flat on the table, screen up. They slide the three phones
together until they touch side by side in the centre, then the hands withdraw completely out of frame.
Soft, warm overhead light. Static vertical top shot with a very slow push-in.
[common rules]
```

---

## Récapitulatif des incrustations

| Plan | Scène | Écrans verts | Captures |
| --- | --- | --- | --- |
| P01 | S01 | 1 | aucune (noir) |
| P02 | S02 | 1 | n° 1 |
| P03 | S03 | 1 | n° 1 |
| P04 | S03 | 1 | n° 2, puis n° 3 |
| P05 | S04 | 1 | n° 4 |
| P06 | S04 | 1 | n° 5 |
| P07 | S05 | 1 | n° 6, puis n° 7, puis n° 8 |
| P08 | S06b | 3 | aucune (noir) |
| P09 | S06b | 3 | n° 9, n° 4, n° 6 |
| P10 | S06 | 3 | n° 9, n° 4, n° 6, puis n° 10 |
