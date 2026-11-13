# Décisions prises pendant la construction du prototype

Le brief demandait de trancher seul les points ambigus et de les noter ici.

## Cadre de travail

1. **Pas de Xcode pendant cette session.** Le travail a été fait dans un conteneur Linux : ni Xcode,
   ni `xcodebuild`, ni SDK macOS. Le projet n'a donc **jamais été compilé ni lancé**. Ce qui a pu être
   vérifié à la place est détaillé dans `RAPPORT.md`. Tout le reste de ce fichier découle de cette
   contrainte : à chaque choix, la solution la moins risquée à la première compilation.
2. **Emplacement : `torix-mac/` dans le dépôt Tiroir existant**, sur la branche de la session, plutôt
   qu'un nouveau dépôt Git. La session n'a accès qu'à ce dépôt ; le dossier est autonome et se déplace
   tel quel dans un dépôt à lui.
3. **Projet Xcode écrit à la main** (`Torix.xcodeproj`, format Xcode 16+ à dossier synchronisé : tout
   fichier ajouté dans `Torix/` entre dans la cible sans toucher au projet). **Plan B** si Xcode le
   refuse : `project.yml` pour XcodeGen décrit le même projet.
4. **Swift en mode de langage 5** (`SWIFT_VERSION = 5.0`), avec async/await et Observation. Le mode 6
   rend bloquantes des erreurs de concurrence impossibles à vérifier sans le SDK. Le code de logique
   passe déjà le mode 6 ; la bascule est à tenter une fois le projet compilé.

## Sécurité et confidentialité

5. **Bac à sable (App Sandbox) désactivé.** Il faut lire `~/Torix/Archive/` et tout dossier choisi dans
   les réglages, et la documentation de `KeyboardShortcuts` signale que les raccourcis « Option +
   touche » ne marchaient plus dans une appli en bac à sable sous macOS 15 (non revérifié sous
   macOS 27). À revoir avant toute distribution.
6. **Signature locale** (« Sign to Run Locally »), sans équipe, runtime renforcé désactivé, donc aucun
   fichier d'autorisations. Conséquence : macOS peut redemander micro et reconnaissance vocale après
   une recompilation. Choisir une équipe dans Xcode règle cela.
7. **Aucun appel réseau dans le code.** Seul Xcode va sur Internet, une fois, pour télécharger le
   paquet `KeyboardShortcuts`.
8. **Reconnaissance vocale : jamais de repli en ligne.** Si la dictée française sur l'appareil manque,
   Torix l'explique et n'écoute pas.

## Archive

9. **Clés de `index.json` en français, sans accent** : `id`, `type`, `titre`, `annee`, `personnes`,
   `description`, `chemin` (relatif au dossier d'archive). Types : `musique`, `orgue`, `photo`.
10. **La racine de l'index est un objet** `{ version, note, alias, elements }`. Un simple tableau
    d'éléments est accepté aussi.
11. **`alias` : surnom → personne.** L'exemple contient `"papa": "Denis"`, **supposition tirée de la
    question d'exemple du brief** (« Qu'est-ce que papa jouait en 1976 ? »). À corriger dans
    `index.json` si elle est fausse.
12. **Un `index.json` existant n'est jamais écrasé.** L'exemple n'est écrit que s'il n'y en a pas.
13. **Recherche par mots-clés, tolérante** : accents et casse ignorés, surnoms résolus, années lues dans
    la question si le modèle ne les passe pas, arguments absurdes (année 0, type inconnu) ignorés,
    huit résultats au plus. Pas de recherche sémantique dans ce prototype.
14. **Six exemples** : deux morceaux de Denis (1976), deux pièces d'orgue de Paul Muller (1982, 1991),
    deux photos (2011, 2024). Deux morceaux la même année pour que la question d'exemple allume deux
    étoiles reliées.

## Comportement

15. **« Plein écran »** : le bouton « agrandir » ouvre l'exploration en vrai plein écran. Depuis le Dock,
    le menu ou au lancement, elle s'ouvre en grande fenêtre.
16. **Au lancement, la fenêtre d'exploration s'ouvre**, pour voir tout de suite si Apple Intelligence
    manque.
17. **Fenêtre d'exploration et panneau créés en AppKit**, pas en scènes SwiftUI : ouvrir une scène
    SwiftUI depuis un panneau flottant n'est pas fiable.
18. **Fermer la barre (Échap ou raccourci) coupe l'écoute, la réponse et la voix.** « Agrandir » ne
    coupe rien.
19. **Fin de phrase à l'oral : 1,6 s de silence** envoie la question. Sans un mot pendant 12 s, l'écoute
    s'arrête.
20. **Torix lit sa réponse phrase par phrase pendant qu'elle s'écrit.** Le micro est coupé pendant
    qu'elle parle.
21. **Fenêtre de contexte du modèle dépassée** : nouvelle session, question reposée une fois. Torix
    oublie alors le début de la conversation ; le fil affiché reste entier.
22. **`openItem` demandé par le modèle sur une fiche sans fichier** : l'étoile est mise en avant, sans
    fenêtre « fichier absent ». Un clic de la personne ouvre la fiche.
23. **Carte stellaire** : le temps de gauche à droite, une bande par type. Les étoiles allumées le
    restent pendant toute la conversation ; une constellation par réponse.
24. **Réglage ajouté, non demandé** : « Répondre à voix haute » (on/off).

## Identité visuelle

25. **Bleus de la flamme repris du Torix Lab** (`web/components/torix/palette.ts`, cap nord), pour que
    les deux Torix se ressemblent. Ces couleurs ne sont pas dans `design/tokens.json`, qui ne couvre
    pas cette appli.
26. **Barre des menus : symbole système `flame.fill`**, parce qu'une forme SwiftUI ne s'y affiche pas
    de façon fiable.
27. **Icône d'appli provisoire** dessinée avec le même tracé que la flamme provisoire.
