# Rapport — Torix pour iPhone

## L'essentiel

L'appli iPhone est écrite, le cœur est partagé avec le Mac dans un package `TorixCore`, et le projet
est prêt pour TestFlight côté réglages. **Mais rien n'a été compilé ni lancé** : cette session
tournait sous Linux, sans Xcode ni `xcodebuild`. Ni la cible iPhone, ni la cible Mac après sa
réorganisation. Les cinq critères de réussite restent donc à constater sur ton Mac et ton iPhone.

**Attention à la version Mac.** Le brief dit qu'elle fonctionne dans `/Users/clementougier/torix-mac`.
Je ne vois pas ce dossier ; j'ai travaillé sur la copie du dépôt, où aucune correction n'avait été
poussée. Si tu as modifié du code sur le Mac pour qu'elle compile, ces corrections ne sont pas ici,
et les fichiers concernés ont changé de place (voir « Ce qui a bougé »). Le plus sûr : pousser
d'abord ta version du Mac, ou me dire quelles corrections tu avais faites.

## Ce qui a été vérifié

| Vérification | Résultat |
| --- | --- |
| Syntaxe des 40 fichiers Swift, bonus non branché compris (compilateur Swift 6.2 pour Linux) | Aucune erreur |
| Tests du package (`TorixCore/Tests`) : recherche, exemple, import d'archive | 7 tests sur 7 réussis, sur la partie sans framework Apple |
| Cœur compilé comme un vrai module, utilisé depuis un autre module | Compile ; la conversation, les étoiles et la pause puis reprise du morceau pendant l'écoute se déroulent comme prévu, avec un faux moteur et de faux micro, voix et lecteur |
| Fichier de projet Xcode | Accolades équilibrées, 39 objets, aucun identifiant en double ni manquant — ce n'est pas une preuve qu'Xcode l'accepte |
| `Info-iOS.plist`, `PrivacyInfo.xcprivacy` | Lisibles |
| Icône iPhone | 1024 × 1024, sans transparence |

## Ce qui n'a pas pu être vérifié

- La compilation des deux cibles, et tout ce qui touche aux frameworks d'Apple : SwiftUI, Foundation
  Models, Speech, synthèse vocale, session audio, App Intents.
- Que Siri reconnaît bien les phrases et que le bouton Action propose « Parler à Torix ».
- Que le modèle sur l'appareil appelle `searchArchive` de lui-même pour « Qu'est-ce que papa jouait
  en 1976 ? ». La recherche, elle, renvoie bien les deux morceaux de 1976.
- L'import depuis Fichiers et iCloud Drive sur un vrai iPhone.
- L'acceptation de l'archive par App Store Connect.

## Ce qui a bougé pour le Mac

| Avant | Maintenant |
| --- | --- |
| `Torix/Archive`, `Brain`, `Conversation`, `Voice` | `TorixCore/Sources/TorixCore/…` |
| `Torix/Settings/TorixSettings.swift` | `TorixCore/Sources/TorixCore/Settings/` ; le raccourci clavier reste dans `Torix/Settings/Shortcut.swift` |
| `Torix/UI/FlameView`, `StarMapView`, `ItemCardView`, `Theme` | `TorixCore/Sources/TorixUI/…` |
| `MessageRow` (dans `ExplorationView.swift`) | `TorixCore/Sources/TorixUI/MessageRow.swift` |
| Fond translucide de la barre | `Torix/UI/MacTheme.swift` |

Comportement ajouté sur Mac aussi, puisque le code est commun : un morceau en cours se met en pause
quand Torix écoute ou parle, puis reprend.

## Ce qui est écrit pour l'iPhone

| Demande du brief | État | Où |
| --- | --- | --- |
| Écran bleu nuit, flamme animée, appui pour écouter, champ de texte | Écrit | `TorixiOS/UI/ConversationScreen.swift` |
| Fil avec cartes audio et photo | Écrit | même fichier, vues de `TorixUI` |
| Carte stellaire | Écrit (onglet « Étoiles ») | `TorixiOS/UI/RootView.swift` |
| Intent « Parler à Torix », bouton Action, Siri, Raccourcis | Écrit | `TorixiOS/App/ParlerATorix.swift` |
| Contrôle du Centre de contrôle, widget d'écran verrouillé | **Écrit mais non branché** | `A-brancher/TorixWidgets/` |
| Reconnaissance sur l'appareil, arrêt après un silence | Écrit (code commun) | `TorixCore/…/Voice/` |
| Réponse à voix haute, phrase par phrase | Écrit (code commun) | `TorixCore/…/Voice/SpeechSpeaker.swift` |
| Pause du morceau pendant l'écoute, reprise ensuite | Écrit, logique testée | `ConversationStore`, `MediaPlayer` |
| Archive dans Documents, visible dans Fichiers | Écrit | `TorixiOS/App/AppModel.swift`, `Config/Info-iOS.plist` |
| Exemple identique au Mac au premier lancement | Écrit (même code) | `TorixCore/…/Archive/SampleArchive.swift` |
| Import d'un dossier d'archive | Écrit, copie testée | `ArchiveImporter`, `SettingsScreen.swift` |
| Réglages | Écrit | `TorixiOS/UI/SettingsScreen.swift` |
| Icône 1024 opaque, textes micro et voix, chiffrement, version 0.1.0 (1) | Fait | `TorixiOS/Assets.xcassets`, `Config/Info-iOS.plist`, projet |

## Première compilation : dans quel ordre

1. Ouvrir `torix-mac/Torix.xcodeproj`. S'il ne s'ouvre pas : `brew install xcodegen`, puis `xcodegen`
   dans `torix-mac/`.
2. Compiler d'abord le package seul, c'est le plus rapide à corriger :

```bash
cd torix-mac/TorixCore && swift build && swift test
```

3. Puis le Mac, puis l'iPhone sur simulateur :

```bash
xcodebuild -project torix-mac/Torix.xcodeproj -scheme Torix build
```

```bash
xcodebuild -project torix-mac/Torix.xcodeproj -scheme TorixiOS -destination 'generic/platform=iOS Simulator' build
```

Points à surveiller, du plus probable au moins probable : les trois appels Foundation Models déjà
signalés dans `RAPPORT.md` ; le fichier de projet ; `Package.swift` si ton Xcode est plus ancien que
Swift 6.2 (baisser la première ligne et écrire `.macOS("26.0")`, `.iOS("26.0")`) ; `openAppWhenRun`
dans l'intent, qu'Apple a peut-être remplacé depuis.

Apple Intelligence ne tourne pas forcément dans le simulateur : pour une vraie réponse de Torix,
tester sur l'iPhone.

## Publier sur TestFlight, pas à pas

Il te faut un compte Apple Developer payant (99 $ par an). Sans lui, TestFlight n'est pas disponible.

### 1. Relier Xcode à ton compte
Xcode › Settings… › Accounts › bouton « + » › Apple ID. Connecte-toi.

### 2. Choisir ton équipe de signature
Dans Xcode, clique sur le projet « Torix » tout en haut de la colonne de gauche, puis sur la cible
**TorixiOS**, onglet **Signing & Capabilities**. Laisse « Automatically manage signing » coché et
choisis ton équipe dans « Team ». Xcode crée alors l'identifiant `com.clementougier.torix`.
S'il dit que l'identifiant est déjà pris, change-le ici, et utilise le nouveau à l'étape 3.

### 3. Créer l'app dans App Store Connect
1. Va sur appstoreconnect.apple.com, rubrique **Apps**, bouton « + », **Nouvelle app**.
2. Plateforme : **iOS**.
3. Nom : **Torix**. Ce nom doit être unique sur l'App Store ; s'il est pris, essaie « Torix Mémoire ».
   Le nom sous l'icône restera « Torix ».
4. Langue principale : **Français**.
5. Identifiant de lot : choisis **com.clementougier.torix** dans la liste.
6. SKU : un code à toi, par exemple `torix-ios-001`.
7. Accès utilisateur : **Accès complet**. Clique sur **Créer**.

### 4. Archiver dans Xcode
1. En haut de la fenêtre, choisis le schéma **TorixiOS**, et comme destination **Any iOS Device (arm64)**
   (pas un simulateur, sinon « Archive » reste grisé).
2. Menu **Product › Archive**. Attends la fin : la fenêtre **Organizer** s'ouvre avec ton archive.

### 5. Envoyer le build
1. Dans Organizer, sélectionne l'archive, clique sur **Distribute App**.
2. Choisis **TestFlight Internal Only** (ou « App Store Connect » si ce choix n'apparaît pas), puis
   **Distribute**.
3. Attends « Upload Successful ». Apple traite ensuite le build : compte de 5 à 30 minutes, tu reçois
   un e-mail.

La question sur le chiffrement ne te sera pas posée : la réponse (« non ») est déjà dans l'appli.

### 6. Ajouter le build à un groupe de test interne
1. App Store Connect › ton app › onglet **TestFlight**.
2. Colonne de gauche, **Tests internes**, bouton « + » : crée un groupe, par exemple « Famille ».
3. Ajoute-toi comme testeur. Seules les personnes présentes dans **Utilisateurs et accès** de ton
   compte peuvent être testeurs internes (100 au plus).
4. Dans le groupe, section **Builds**, bouton « + » : coche le build 0.1.0 (1).

### 7. Installer sur l'iPhone
1. Sur l'iPhone, installe l'app **TestFlight** depuis l'App Store.
2. Ouvre l'e-mail d'invitation sur l'iPhone et touche **View in TestFlight**, ou ouvre TestFlight avec
   le même identifiant Apple : Torix y apparaît.
3. Touche **Installer**.

### 8. Premiers réglages sur l'iPhone
1. Réglages › Apple Intelligence et Siri : Apple Intelligence activée, Siri en français.
2. Ouvre Torix, touche la flamme, accepte le micro et la reconnaissance vocale.
3. Bouton Action : Réglages › Bouton Action › Raccourci › Torix › **Parler à Torix**.

### Pour le build suivant
Cible TorixiOS › onglet General › **Build** : passe de 1 à 2 (Apple refuse deux fois le même numéro),
puis reprends à l'étape 4.

## Ce qui reste à faire

- Compiler les deux cibles et corriger ce que le compilateur relèvera.
- Reporter dans ce code les corrections faites sur le Mac, s'il y en a.
- Passer les cinq critères de réussite sur l'iPhone.
- Brancher le bonus (`A-brancher/TorixWidgets/LISEZ-MOI.md`), si tu le veux.
- Gérer les interruptions audio (appel entrant) et le micro des casques Bluetooth.
- Remplacer la flamme et l'icône provisoires : asset `TorixFlame` et
  `TorixiOS/Assets.xcassets/AppIcon.appiconset/icon-1024.png` (1024 × 1024, sans transparence, sans
  coins arrondis).

Les choix faits en route sont dans `DECISIONS-IOS.md`.
