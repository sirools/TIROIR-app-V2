# Torix — voix de synthèse sur l'hymne « النشيد لإيلون ماسك »

Un script qui fabrique la piste vocale de l'hymne, entièrement en local :
synthèse arabe (Piper), calage de chaque vers sur ses mesures, refrains
chantés sur la mélodie guide, passage par le module de voix de Torix, puis un
WAV 48 kHz / 24 bits qui commence à la mesure 1 et dure exactement le morceau.

## État au 20 novembre 2026

Écrit et essayé dans une session cloud, **sans** le set Ableton, la fiche de
paroles ni le module de voix (aucun des trois n'était accessible). Ce qui a
été vérifié l'a été sur des paroles et une mélodie d'essai :

| Point | Vérifié ? |
| --- | --- |
| Dépendances installables (Python 3.13, Linux) | oui |
| WAV 48 kHz / 24 bits mono, 146,09 s pour 56 mesures à 92 BPM | oui |
| Vers parlés : attaque à moins de 10 ms du premier temps | oui (mesuré) |
| Refrains : hauteur mesurée = note du guide (écart médian < 1 cent) | oui (mesuré) |
| Arabe parlé reconnu par une reconnaissance vocale locale (Whisper) | oui |
| Arabe chanté reconnu de la même façon | en partie seulement — voir Limites |
| Écoute par un arabophone | **non** |
| Vraies paroles, vraie mélodie guide | **non** — à fournir |
| Conversion vers le timbre de Torix | **non** — commande à renseigner |
| Import dans Ableton | **non** — à faire sur le Mac (étapes plus bas) |

## Installation (sur le Mac)

```bash
brew install ffmpeg
```

```bash
cd torix-hymne-voix && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

Les voix Piper (arabe `ar_JO-kareem-medium`, anglaise `en_US-amy-medium`,
environ 60 Mo chacune) se téléchargent au premier lancement, puis tout tourne
hors ligne.

## Ce qu'il faut fournir

1. **Les paroles** — `paroles/*.txt`, un fichier par section, à remplir depuis
   `Torix_Hymne_Elon_paroles.md`. Une ligne par vers :

   ```
   mesure[:durée en mesures] [@style] | texte avec tashkeel
   17 | …            ← vers de 2 mesures, style de la section
   54 @parle | …     ← style forcé pour ce vers
   49:4 | …          ← vers étalé sur 4 mesures
   ```

   Styles : `parle`, `chante`, `murmure`. Garder les tashkeel. Laisser
   « Interesting », Tesla, Starlink, Neuralink, SpaceX en lettres latines :
   ils passent par la voix anglaise.
   `paroles/6_fin.txt` contient déjà les deux vers du brief, sans tashkeel et
   avec des mesures supposées : à corriger.

2. **La mélodie guide** — dans Ableton, clic droit sur le clip de
   « Torix — mélodie guide » → *Exporter le clip MIDI*, vers
   `guide/torix_melodie_guide.mid`. Si le clip ne commence pas à la mesure 1,
   indiquer `guide.decalage_mesures` dans `config.yaml` (8 s'il commence à la
   mesure 9). Un `.json` de notes (`pitch`, `start_time`, `duration` en temps)
   est accepté aussi.

3. **Le module de voix de Torix** — `conversion_voix.commande` dans
   `config.yaml`, par exemple :

   ```yaml
   commande: "python /chemin/vers/module_voix.py --entree {entree} --sortie {sortie}"
   ```

   Le script lui passe un WAV 48 kHz mono par section et relit le résultat.
   Le module ne doit pas transposer la hauteur (elle suit déjà le guide).
   Sans commande, on entend le timbre brut de Piper.

## Lancer

```bash
.venv/bin/python hymne_voix.py --plan
```

affiche le calage (mesure, minutage, nombre de notes par vers chanté) sans
rien synthétiser. Puis :

```bash
.venv/bin/python hymne_voix.py
```

Sorties dans `sortie/` :

- `torix_voix.wav` — la piste complète ;
- `sections/torix_voix_<section>.wav` — une piste par section, chacune de la
  durée du morceau : elles se posent toutes au temps 0 ;
- `rapport.json` — par vers : début, étirement appliqué, syllabes et notes,
  alertes (vers trop long, vers sans note…).

Après un changement de vers ou de tempo, relancer la même commande : la
synthèse est en cache par vers, seul ce qui a changé est refait.
`--section refrain1` ne régénère qu'une section ; `--sans-conversion` saute le
module de voix.

## Comment ça marche

- **Couplets, fin parlée** : synthèse, puis étirement sans changement de
  hauteur (Rubber Band via ffmpeg) pour occuper 90 % des deux mesures. Borné
  entre ×0,75 et ×1,5 : au-delà la voix se déforme, donc un vers court part
  sur le temps et laisse du silence, un vers trop long est signalé.
- **Pont** : idem, puis une part du voisement est remplacée par du souffle
  (vocodeur WORLD) et le niveau baisse de 6 dB.
- **Refrains** : Piper donne la durée de chaque phonème. Le script repère les
  syllabes, en pose une par note (mélisme s'il y a plus de notes que de
  syllabes, partage des notes dans le cas inverse), allonge les voyelles et
  non les consonnes, et resynthétise avec la hauteur du MIDI — léger glissé
  entre notes, vibrato sur les notes longues. La voyelle tombe sur le temps,
  la consonne juste avant, comme chez un chanteur.
- **Finition** : passe-haut 80 Hz, de-essing léger, compression 2,5:1, crête à
  −3 dBFS. Pas de reverb.

## Import dans Ableton

1. Créer une piste audio « Torix — voix ».
2. Y glisser `sortie/torix_voix.wav` en vue Arrangement, à 1.1.1, **Warp
   désactivé** (sinon Live recale le fichier).
3. Envois A-Reverb et B-Delay légers (départ : −18 dB et −24 dB).
4. Couper (mute) la piste MIDI « Torix — mélodie guide ».

## Limites, et pour aller plus loin

- **Prononciation.** Piper lit l'arabe via eSpeak : correct avec tashkeel,
  approximatif sans. La voix est jordanienne et masculine ; c'est la
  conversion de voix qui donne le timbre de Torix. À faire valider par un
  arabophone, vers par vers.
- **Refrains.** La justesse est exacte, mais c'est de la parole étirée 2,5 à
  3 fois : à la reconnaissance vocale, les vers chantés ne ressortent qu'en
  partie. Un mot anglais au milieu d'un vers chanté est le cas le plus
  fragile. Si c'est insuffisant à l'oreille : raccourcir les notes tenues du
  guide, ou passer un vers en `@parle`.
- **Pas de vrai moteur de chant.** Aucun moteur local libre ne chante
  l'arabe avec une banque de voix prête à l'emploi ; d'où la voie « synthèse
  puis hauteur imposée ». Pour aller plus loin : enregistrer les refrains
  chantés par une personne (même approximativement) et ne garder que la
  conversion de voix — c'est ce qui donnerait le plus gros gain.
- **Mots anglais.** Dits par une autre voix (féminine, américaine) ; la
  conversion de voix doit lisser la différence, à vérifier à l'écoute.
- **Murmure.** La conversion de voix peut mal réagir à une voix soufflée :
  baisser `murmure.souffle` si le pont sort abîmé.
- **Latence du module de voix.** S'il décale le son, le calage bouge d'autant ;
  vérifier le début du couplet 1 contre le premier temps de la mesure 9.
