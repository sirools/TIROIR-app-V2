# Bonus non branché : widget d'écran verrouillé et bouton du Centre de contrôle

Ce dossier n'appartient à aucune cible Xcode et son code n'a jamais été compilé. Il a été laissé de
côté parce qu'ajouter une extension à la main dans le fichier de projet, sans Xcode pour vérifier,
risquait de casser les deux applis.

Pour l'activer dans Xcode :

1. File › New › Target… › iOS › **Widget Extension**. Nom : `TorixWidgets`. Décocher « Include Live
   Activity » et « Include Configuration App Intent ». Cocher « Include Control ». Embed in : `TorixiOS`.
2. Supprimer les fichiers Swift que Xcode vient de créer dans le nouveau dossier `TorixWidgets`, et y
   glisser `TorixWidgets.swift` (ce dossier).
3. Sélectionner `TorixiOS/App/ParlerATorix.swift`, et dans l'inspecteur de droite (Target Membership),
   cocher aussi `TorixWidgets`.
4. Dans `ParlerATorix.swift`, l'appel `AppModel.shared.requestListening()` n'existe pas côté widget :
   l'entourer de `#if !WIDGET` … `#endif`, et ajouter `WIDGET` dans Build Settings › Active Compilation
   Conditions de la cible `TorixWidgets`.
5. Compiler. Le lien `torix://ecouter` est déjà géré par l'appli (`RootView.swift`).
