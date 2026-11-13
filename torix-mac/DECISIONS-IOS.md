# Décisions prises pour la version iPhone

Le brief demandait de trancher seul les points ambigus et de les noter ici. Les décisions de la
version Mac restent dans `DECISIONS.md`.

## Cadre de travail

1. **Pas de Xcode pendant cette session** (conteneur Linux) : ni la cible iPhone ni la cible Mac n'ont
   été compilées. Ce qui a été vérifié à la place est dans `RAPPORT-IOS.md`.
2. **Point de départ : la copie du dépôt, pas `/Users/clementougier/torix-mac`**, que je ne vois pas.
   Aucune correction n'avait été poussée sur le dépôt : si la version Mac a été corrigée sur le Mac
   pour tourner, ces corrections sont à reporter dans ce code (voir le rapport).
3. **Le dossier garde son nom `torix-mac/`** et le projet reste `Torix.xcodeproj`, avec deux cibles :
   `Torix` (Mac) et `TorixiOS` (iPhone). Renommer le dossier aurait cassé les repères existants.

## Architecture

4. **Un package local `TorixCore/` avec deux bibliothèques.** `TorixCore` : cerveau, conversation,
   archive, outils, personnalité — et aussi la voix (écoute et synthèse), le lecteur audio et les
   réglages, parce que `ConversationStore` en dépend et que ce code est le même sur les deux
   appareils. `TorixUI` : les vues SwiftUI communes (flamme, carte stellaire, cartes, messages).
5. **Dans la cible Mac ne restent que** la barre flottante, la fenêtre d'exploration, les réglages Mac,
   le raccourci clavier et le menu. **Dans la cible iPhone** : les trois écrans, l'intent, l'import.
6. **Les outils `searchArchive` et `openItem` restent internes au package** : seul `AppleFoundationBrain`
   s'en sert.
7. **Package en outils Swift 6.2, plateformes macOS 26 et iOS 26**, code en mode de langage 5, comme
   la cible Mac. La cible Mac reste réglée sur macOS 27.
8. **Mots adaptés à l'appareil** (« cet iPhone » / « ce Mac », « Réglages » / « Réglages Système ») par un
   petit `Platform` dans le package.

## Appli iPhone

9. **Cible minimale : iOS 26.0**, iPhone seul (`TARGETED_DEVICE_FAMILY = 1`), **portrait seul**. Ajouter
   l'iPad impose d'autres orientations et d'autres icônes ; inutile pour un iPhone 17 Pro Max.
10. **Nom du produit `TorixiOS.app`, nom affiché « Torix ».** Deux produits `Torix.app` dans un même
    projet écrit à la main : risque évité. Siri et l'écran d'accueil utilisent le nom affiché.
11. **Trois onglets** : Torix (conversation), Étoiles (carte stellaire), Réglages. Le brief laissait le
    choix entre onglet et geste.
12. **La flamme est grande et centrée tant que la conversation est vide ;** dès qu'il y a un fil, elle
    passe en petit entre le fil et le champ de texte, toujours touchable.
13. **Sur un écran en hauteur, la carte stellaire pivote** : le temps descend, une colonne par type.
14. **« Écoute automatique à l'ouverture » = au lancement de l'appli**, pas à chaque retour au premier
    plan. Le bouton Action, Siri et les raccourcis démarrent toujours l'écoute.
15. **Quand l'appli quitte l'écran, tout s'arrête** (micro, réponse, voix). Pas de micro en arrière-plan.

## Accès en un geste

16. **L'intent s'appelle `ParlerATorix` dans le code**, sans accent, et « Parler à Torix » à l'écran.
    Un nom de type accentué est du Swift valide, mais je n'ai pas pu vérifier que les outils d'Apple
    qui lisent les intents à la compilation l'acceptent.
17. **Phrases Siri** : « Parle à Torix », « Parler à Torix », « Demande à Torix », « Je veux parler à
    Torix ». Elles sont écrites en français, langue de développement du projet.
18. **Bonus (Centre de contrôle, écran verrouillé) : écrit mais non branché**, dans
    `A-brancher/TorixWidgets/`, avec la marche à suivre. Il demande une cible d'extension, trop risquée
    à ajouter à la main dans le fichier de projet. Le lien `torix://ecouter` est déjà géré par l'appli.

## Voix et son

19. **Une seule catégorie de session audio, « lecture et enregistrement », haut-parleur par défaut**,
    pour ne pas couper le son en changeant de catégorie.
20. **Le morceau en cours se met en pause quand Torix écoute, cherche ou parle, et reprend quand elle a
    fini.** Vaut aussi sur Mac, puisque le code est commun.
21. **Non géré** : les interruptions (appel téléphonique) et le casque Bluetooth en mode micro.

## Archive

22. **L'archive est dans `Documents/Archive/`** : dans Fichiers › Sur mon iPhone › Torix › Archive.
23. **L'import remplace l'archive, sans rien supprimer** : l'ancienne est renommée « Archive avant
    import <date> » à côté. Un dossier sans `index.json` lisible est refusé, et rien ne bouge.
24. **L'import copie les fichiers dans l'appli** plutôt que de lire le dossier d'origine : pas de droit
    d'accès à garder d'un lancement à l'autre.
25. **iCloud Drive** : les fichiers non téléchargés sur l'iPhone ne sont pas récupérés automatiquement.

## TestFlight

26. **Identifiant `com.clementougier.torix`**, comme proposé. Pour le changer : cible `TorixiOS` ›
    Signing & Capabilities › Bundle Identifier (avant de créer l'app dans App Store Connect).
27. **Équipe de signature laissée vide** : je ne connais pas l'identifiant de l'équipe. À choisir dans
    Xcode, une fois (étape 2 du rapport).
28. **Une seule icône 1024 × 1024**, opaque. Depuis Xcode 14, c'est le « jeu complet » : Xcode fabrique
    les autres tailles.
29. **Fichier de confidentialité `PrivacyInfo.xcprivacy` ajouté** : aucune collecte, aucun suivi, et la
    déclaration d'usage des préférences (UserDefaults) qu'Apple réclame à l'envoi.
30. **La cible Mac garde son identifiant `app.tiroir.torix.mac`** et sa version 0.1 : le brief ne
    demandait pas d'y toucher.
