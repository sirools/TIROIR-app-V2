# Landing — section « Une photo, c'est tout. » : ce qu'il reste à fournir

Branche `feat/landing-une-photo` (partie de `origin/main`, qui porte le hero « trois tiroirs »).

## Ce qui est livré

- `web/components/home/PhotoSimple.tsx` : la section, juste après le hero, avant « Pour les créatifs et les pros ». Elle **remplace « Comment ça marche »** (mêmes trois étapes : garder les deux faisait répéter la même chose deux fois de suite).
- `web/components/DemoVideo.tsx` (+ `.module.css`) : vidéo réutilisable. Lecture automatique, muette, en boucle, `playsInline`, avec poster. Rien n'est téléchargé avant que le bloc approche de l'écran. Pause hors de l'écran, bouton lecture/pause, textes superposés synchronisés et cadre téléphone à partir de 1000 px. En mouvement réduit, pas de lecture automatique.
- Animations : apparition décalée des étapes au scroll, puis une boucle CSS de 9 s (photo → la fiche se remplit champ par champ → l'objet glisse dans le tiroir). Elles n'utilisent que `transform` et `opacity`, sans librairie. La boucle tourne seulement à l'écran. En mouvement réduit, tout est statique : fiche remplie, objet rangé.
- Textes : `home.photo` dans `web/locales/{fr,en,es,de,da}.ts`.

## À fournir

1. **Vidéo finale**, 9:16 (1080×1920 conseillé), 10 à 20 s, sans son. Remplacer `web/public/assets/video/demo-photo.mp4`. Le fichier actuel est un **placeholder** fait avec le poster du hero (86 Ko). Cible : moins de 1,5 Mo, H.264, `-movflags +faststart`. Une version WebM est possible, il faudra alors ajouter une `<source>`.
2. **Poster** : `web/public/assets/video/demo-photo-poster.jpg`, première image de la vraie vidéo (JPEG, moins de 60 Ko).
3. **Rythme des textes superposés** : la vidéo est découpée en trois tiers égaux (« Tu prends la photo », « Torix remplit la fiche », « C'est rangé »). Si la vidéo finale a un autre rythme, ajuster `from` dans `PhotoSimple.tsx` (fraction de la durée, de 0 à 1).
4. **Badge « 10 secondes »** : le confirmer avec la vraie vidéo. Il doit rester vrai (l'analyse prend 5 à 10 s dans l'app).
5. **Traductions** : en, es, de et da sont des premières versions à faire relire.
   - **Portugais** : le site ne propose pas encore le portugais (`site: false` pour pt-BR/pt-PT). Le brouillon est prêt, à brancher quand le site l'ouvrira :
     - Titre : « Uma foto, e pronto. »
     - Sous-titre : « O Torix, a IA do Tiroir, reconhece o teu objeto e preenche a ficha. Tu só escolhes a gaveta. » (pt-PT ; pt-BR : « reconhece seu objeto… Você só escolhe a gaveta. »)
     - Réassurance : « Grátis, sem cartão. {n} ações de IA por mês incluídas. »
     - Bouton : « Experimentar grátis »

## Écarts avec le brief, pour rester ISO avec l'app

- **« le range pour toi »** : dans l'app, c'est la personne qui choisit le tiroir, pendant l'analyse (sélecteur de collection, ou « Sans collection »). Le texte devient donc : « Toi, tu choisis juste le tiroir. »
- **L'estimation dans la fiche** : Torix remplit le nom, la catégorie et l'état. L'estimation est un geste de plus (« Estimer avec Torix », 8 crédits). La fiche animée affiche donc la ligne « Valeur » avec un bouton « ✦ Estimer », sans montant.
- **« 20 actions IA par mois »** : le nombre vient de `OFFERS_V4.free.aiActionsPerMonth`, comme la page Tarifs. Attention : la grille V4 n'est pas encore celle que vend l'app (`OFFERS.free.aiObjects`, 20 aussi).

## Points à trancher

- **Tutoiement** : la section tutoie (comme le demande le brief, et comme l'app), mais le reste du site vouvoie. En allemand, « du » côtoie « Sie ». Il faut soit passer tout le site au tutoiement, soit vouvoyer cette section.
- **Torix nommé sur le site** : `web/locales/fr.ts` pose la règle « L'IA n'apparaît jamais dans un titre ». Or le titre d'étape « Torix remplit la fiche » la nomme. C'est la demande du brief, mais c'est une entorse à ce principe.
