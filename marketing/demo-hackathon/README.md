# Vidéo de démo Tiroir — hackathon Google (After Effects)

Vidéo en anglais, 1920 x 1080 (16/9), environ 2 min 30, qui montre Tiroir
et ce que fait Firebase. Le projet After Effects est créé par
`creer_projet_demo.jsx`.

## Lancer le script

1. Copier ce dossier sur le Mac (de préférence en gardant le dépôt entier :
   le script lit alors les couleurs dans `design/tokens.json`).
2. Déposer les médias dans les dossiers, **sous les noms ci-dessous**.
3. Dans After Effects : *Fichier › Scripts › Exécuter le fichier de script…* →
   `creer_projet_demo.jsx`. Le projet `Tiroir_Demo_Hackathon_EN.aep` est
   enregistré à côté du script (s'il existe déjà, un nouveau projet daté est
   créé, sans rien écraser).
4. À la fin, une fenêtre liste ce qu'il manque encore.

Chaque fichier absent est remplacé par une doublure nommée
`MISSING — …` (mire de couleurs). Pour la remplacer : la sélectionner dans
le panneau Projet, puis *Fichier › Remplacer le métrage › Fichier…*, ou
déposer le fichier et relancer le script.

## Noms attendus

Le script prend le premier fichier dont le nom **commence** par le préfixe
(majuscules ou minuscules, peu importe). Exemple : `Rush_Dessin_1_prise3.mov`.

| Dossier | Préfixe | Contenu |
|---|---|---|
| `01_VO` | `vo_full` | VO anglaise complète, **ou** une par partie : `vo_1` … `vo_6` |
| `01_VO` | `music` | Musique (facultative), posée à −14 dB sous la voix |
| `02_Rushes` | `rush_dessin_1`, `rush_dessin_2` | Rushes de Stéphane : Clément range les deux dessins |
| `02_Rushes` | `rush_pantalon_1`, `rush_pantalon_2` | Rushes de Stéphane : Clément range les deux pantalons |
| `03_Captures_web` | `web_collections` | Capture 16/9 : navigation entre les collections |
| `03_Captures_web` | `web_fiche` | Capture 16/9 : ouverture d'un objet, lecture de sa fiche |
| `04_Captures_iPhone` | `iphone_ajout` | Capture verticale : photo, puis fiche (1179 x 2556 idéalement) |
| `05_Mockup` | `iphone_mockup` | Facultatif : PNG d'iPhone à l'écran transparent |
| `06_Exports` | — | Sortie de la file de rendu (`Tiroir_Demo_EN_16x9.mov`) |

**Cadence** : le script lit celle du premier rush trouvé (`rush_…`) et
l'applique à toutes les compositions ; sans rush, 30 i/s.

Les médias ne sont pas suivis par git (voir `.gitignore`) : trop lourds.

## Ce que le script construit

```
10_Comps/
  MAIN_Tiroir_Demo_EN_16x9      ← composition principale, 6 marqueurs
  Parties/  S1_Hook · S2_RealLife · S3_iPhone · S4_Web · S5_UnderTheHood · S6_End
  Precomps/ PRE_iPhone_Screen   ← la capture verticale, à la taille de l'écran
            PRE_iPhone_Mockup   ← coque + écran aux coins arrondis (cache alpha) + Dynamic Island
            PRE_Schema_Firebase ← schéma animé de la partie 5
```

| # | Partie | Début | Durée | Contenu |
|---|---|---|---|---|
| 1 | Hook | 0:00 | 12 s | « Where did I put it? » / « What do I even own? », puis le logo |
| 2 | Tiroir for real | 0:12 | 28 s | Les 4 rushes de Stéphane, 7 s chacun, légendés |
| 3 | iPhone | 0:40 | 30 s | iPhone à gauche, 3 étapes à droite, fond beige |
| 4 | Web | 1:10 | 30 s | Les 2 captures dans une fenêtre de navigateur |
| 5 | Under the hood | 1:40 | 35 s | Schéma Firebase AI Logic |
| 6 | End | 2:15 | 15 s | Logo, « Know what you own. Find it in seconds. », tiroir.app, crédits |

Les durées sont des points de départ : une fois la VO posée, recaler les
parties sur elle (si `vo_full` dure plus de 2 min 30, la composition
principale s'allonge d'elle-même).

Couleurs et police : `design/tokens.json` (orange `#F26900`, beige
`#FFF4E6`, encre `#121212`, Inter). Le logo est redessiné en formes d'après
`web/public/logo-tiroir.svg`, donc net à toute taille.

## Attention : ce que fait Firebase dans Tiroir

Le brief prévoyait « comment Firebase stocke et synchronise les objets ».
**Ce n'est pas ce que fait Firebase dans Tiroir**, et un jury Google
le verrait. D'après le code (`web/lib/hybridAI/`,
`mobile/src/services/hybridAI/`) :

- Firebase sert la **Fiche express** (build hackathon, derrière un drapeau),
  via **Firebase AI Logic** en mode hybride ;
- le modèle **embarqué** passe d'abord : Apple Foundation Models sur iPhone
  (après lecture de la photo par Vision), l'IA intégrée de Chrome sur le site ;
- s'il n'est pas disponible, **Gemini dans le cloud** (3.5 Flash-Lite par
  défaut) prend le relais, protégé par **App Check** ;
- le stockage des objets de Tiroir, c'est Supabase, pas Firebase. La Fiche
  express du site garde ses brouillons dans le navigateur.

La partie 5 montre donc ce trajet : iPhone / Web → IA embarquée → (sinon)
Firebase AI Logic + Gemini → fiche. Elle reprend la phrase de
confidentialité du site : *« On device, the photo never leaves your browser.
In the cloud, it is sent to Gemini through Firebase AI Logic. »* Si la VO
déjà enregistrée parle de stockage ou de synchronisation par Firebase, il
faudra la réenregistrer pour ce passage.

## Ce qui existe déjà dans le dépôt (vérifié)

- `web/public/flows/flow-a…d.mp4` : captures de l'app, **interface en
  français**, au format 1290 x 1080. Pas utilisées : la vidéo est en anglais.
- `web/public/assets/video/demo-photo.mp4`, `web/public/hero/trois-tiroirs.mp4` :
  illustrations animées du site (iPhone + tiroirs). Elles peuvent servir de
  plans de coupe : à importer à la main si besoin.
- `marketing/reel/` : le reel vertical (Remotion) ; ses captures ne sont pas
  dans le dépôt.
- Aucune voix off ni aucun rush dans le dépôt.

## À compléter avant l'export

- [ ] Vérifier la durée maximale dans le règlement du hackathon (cible 2 à 3 min).
- [ ] Crédits (`S6_End`) : titre, artiste, source et licence de la musique.
- [ ] Si un mockup externe est utilisé : sa source et sa licence (sinon, la
      ligne dit que l'iPhone est dessiné dans After Effects, sans élément tiers).
- [ ] Le nom de famille de Stéphane, si Stéphane souhaite qu'il figure aux crédits.
