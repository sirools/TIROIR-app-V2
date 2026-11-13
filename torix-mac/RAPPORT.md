# Rapport — prototype Torix pour Mac

## L'essentiel

Tout le prototype est écrit, mais **il n'a pas été compilé ni lancé** : la session tournait dans un
conteneur Linux, sans Xcode ni `xcodebuild`. La première compilation sur le Mac reste donc à faire, et
elle peut demander quelques corrections (voir « Points à surveiller »). Aucun des critères de réussite
du brief n'a pu être constaté à l'écran.

## Lancer l'appli

Le projet est dans `torix-mac/`, sur la branche `claude/relaxed-goldberg-6fyv9e`.

1. Ouvrir `torix-mac/Torix.xcodeproj` dans Xcode.
2. Laisser Xcode télécharger le paquet `KeyboardShortcuts` (seul accès réseau, une fois).
3. Choisir le schéma « Torix », destination « My Mac », puis lancer (⌘R).
4. Au premier usage du micro, accepter les deux demandes : micro et reconnaissance vocale.

En ligne de commande :

```bash
xcodebuild -project torix-mac/Torix.xcodeproj -scheme Torix -configuration Debug build
```

Si Xcode refuse d'ouvrir le projet (il a été écrit à la main), le régénérer :

```bash
brew install xcodegen
```

```bash
cd torix-mac && xcodegen
```

Prérequis sur le Mac : Apple Intelligence activée (Réglages Système › Apple Intelligence et Siri), et
la dictée française installée pour la reconnaissance sur l'appareil. Sans l'une ou l'autre, Torix
l'explique dans un bandeau.

## Ce qui a été vérifié

| Vérification | Résultat |
| --- | --- |
| Syntaxe des 26 fichiers Swift (compilateur Swift 6.2 pour Linux) | Aucune erreur |
| Archive, index d'exemple, recherche : compilés et exécutés | « Qu'est-ce que papa jouait en 1976 ? » renvoie les deux morceaux de Denis de 1976 ; une recherche sans résultat renvoie une liste vide |
| Conversation (`ConversationStore`, écoute, constellations) : compilée et exécutée avec un faux moteur et de faux micro/voix | Réponse en flux, cartes, étoiles allumées, découpage en phrases pour la voix, envoi après un silence : conformes |
| `Info.plist` | Lisible, textes micro et reconnaissance vocale en français |

## Ce qui n'a pas été vérifié

Tout ce qui dépend des frameworks d'Apple, absents sous Linux : l'interface SwiftUI et AppKit, Foundation
Models, Speech, AVFoundation, `KeyboardShortcuts`, le fichier de projet Xcode et le catalogue d'images.
Ce code a été écrit de mémoire des API, sans compilateur pour le contredire.

## Ce qui est écrit, fonction par fonction

| Demande du brief | État | Où |
| --- | --- | --- |
| Barre flottante (`NSPanel` non activant, translucide, en haut de l'écran) | Écrit | `UI/FloatingPanel.swift`, `UI/BarView.swift` |
| Flamme animée selon l'état (repos, écoute, réflexion, parole) | Écrit | `UI/FlameView.swift` |
| Option + Espace, modifiable ; Échap ferme ; écoute automatique | Écrit | `Settings/TorixSettings.swift`, `App/AppController.swift` |
| Réponse en flux sous le champ, barre qui grandit | Écrit | `UI/BarView.swift` |
| Fenêtre d'exploration, même conversation | Écrit | `UI/ExplorationView.swift`, `Conversation/ConversationStore.swift` |
| Carte stellaire, étoiles allumées et reliées | Écrit | `UI/StarMapView.swift` |
| Cartes dans le fil : lecteur audio, vignette photo | Écrit | `UI/ItemCardView.swift` |
| Icône du Dock, flamme dans la barre des menus | Écrit | `App/TorixApp.swift` |
| Personnalité de Torix | Écrit | `Brain/TorixPersonality.swift` |
| `TorixBrain`, `AppleFoundationBrain`, emplacement `OllamaBrain` | Écrit (Ollama : emplacement vide, comme demandé) | `Brain/` |
| Outils `searchArchive` et `openItem` | Écrit | `Brain/ArchiveTools.swift` |
| Mini-archive `~/Torix/Archive/`, six exemples | Écrit et testé | `Archive/` |
| Voix entrante, sur l'appareil, fr-FR | Écrit | `Voice/SpeechCapture.swift`, `Voice/SpeechListener.swift` |
| Voix sortante, meilleure voix française | Écrit | `Voice/SpeechSpeaker.swift` |
| Réglages | Écrit | `UI/SettingsView.swift` |
| Message si Apple Intelligence n'est pas activée | Écrit | `Brain/AppleFoundationBrain.swift` |

## Points à surveiller à la première compilation

Par ordre de probabilité :

1. **Foundation Models** (`Brain/AppleFoundationBrain.swift`, `Brain/ArchiveTools.swift`). Le code suit
   l'API de macOS 26 telle que je la connais ; je n'ai pas pu la confronter au SDK de macOS 27. Trois
   endroits précis : `snapshot.content` dans la boucle de flux, le type de retour `String` de
   `Tool.call(arguments:)`, et les cas de `SystemLanguageModel.Availability.UnavailableReason`.
2. **Le projet Xcode** (`Torix.xcodeproj/project.pbxproj`). Plan B : `xcodegen`, ci-dessus.
3. **`MACOSX_DEPLOYMENT_TARGET = 27.0`**. Si le Xcode installé ne connaît pas encore macOS 27, baisser
   à 26.0 dans les réglages de la cible.
4. **L'asset `TorixFlame` est vide** : Xcode affichera un avertissement, sans gravité, tant que le logo
   n'y est pas.
5. **Hauteur de la barre flottante** : elle suit la hauteur du contenu SwiftUI. C'est le réglage visuel
   le plus délicat ; à ajuster dans `FloatingPanelController.resize` si la barre tremble ou coupe le texte.

## Ce qui reste à faire

- Compiler, lancer, et passer les cinq critères de réussite du brief un par un.
- Vérifier que le modèle sur l'appareil appelle bien `searchArchive` de lui-même. S'il l'oublie trop
  souvent, la parade la plus simple est de lancer la recherche dans l'appli avant de lui poser la
  question, et de lui donner les résultats.
- Remplacer les six exemples par de vrais souvenirs (voir ci-dessous).
- Déposer le logo officiel.
- `OllamaBrain` : second moteur, laissé vide avec un TODO.
- Pas de tests dans le projet Xcode : ceux de cette session ont tourné hors projet.
- Avant toute distribution : bac à sable, runtime renforcé, signature avec une équipe.

## Remplir l'archive

Au premier lancement, l'appli crée `~/Torix/Archive/` avec `Musique/`, `Orgue/`, `Photos/` et un
`index.json` de six éléments fictifs marqués « exemple », sans fichier média. Pour un vrai souvenir :
déposer le fichier dans le bon sous-dossier, puis ajouter une entrée dans `index.json` :

```json
{
  "id": "denis-1976-ballade",
  "type": "musique",
  "titre": "Ballade du grenier",
  "annee": 1976,
  "personnes": ["Denis"],
  "description": "Guitare, enregistré sur cassette.",
  "chemin": "Musique/ballade-du-grenier.m4a"
}
```

Types acceptés : `musique`, `orgue`, `photo`. Le bloc `alias` de l'index relie un surnom à une personne ;
l'exemple contient `"papa": "Denis"`, une supposition à corriger si besoin. Après une modification :
Réglages › Archive › « Recharger l'archive ».

## Logo : où déposer la flamme officielle

- **Dans l'appli** : glisser le fichier vectoriel (PDF ou SVG) dans Xcode, sur l'asset `TorixFlame` de
  `Torix/Assets.xcassets`. Dès qu'il est présent, `FlameView` l'utilise à la place de la flamme
  provisoire dessinée en SwiftUI (`FlameShape`), avec les mêmes animations.
- **Icône du Dock** : remplacer les PNG de `Torix/Assets.xcassets/AppIcon.appiconset/` (16 à 1024 px).
  Les fichiers actuels sont provisoires.
- **Barre des menus** : symbole système `flame.fill` pour l'instant, dans `App/TorixApp.swift`.

## Confidentialité

Le code ne fait aucun appel réseau et ne contient aucun outil de mesure d'audience. Le modèle, la
reconnaissance vocale (`requiresOnDeviceRecognition = true`, sans repli en ligne) et la synthèse vocale
tournent sur le Mac.

Les choix faits en route sont dans `DECISIONS.md`.
