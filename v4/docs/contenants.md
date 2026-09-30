# Contenants numérotés — plan (décidé le 30 septembre 2026)

Décision du fondateur : dans la V4, **juste après le mode coffre**. Point de
départ : l'usage de Mélanie (styliste), qui vide une valise pour en faire
une « brouette » de vêtements à vendre, et doit savoir **de quelle valise
vient chaque vêtement**.

## Ce qui existe déjà

L'emplacement d'un objet se range en briques (`location_note`, ex.
`Atelier › Valise 3`). En attendant les contenants, c'est la façon de faire.

## Ce qu'on ajoute

1. **Un contenant** (valise, carton, malle…) a un nom et un **numéro**
   (« Valise n° 3 »), une photo, et une **étiquette QR** à imprimer et à
   coller dessus.
2. **Photographier le contenu d'un contenant** (ajout en rafale) rattache
   chaque objet à ce contenant, sans rien saisir.
3. **Chaque fiche dit d'où vient l'objet** : « Vient de : Valise n° 3 ».
   Scanner l'étiquette ouvre la liste de tout ce que le contenant contient
   ou a contenu.
4. **Pour vendre** : filtrer « Valise n° 3 → à vendre » et préparer toutes
   les annonces d'un coup (lien avec `vente.md`, étape 1).
5. Un objet garde son contenant d'origine même quand il en change :
   l'histoire de l'objet ne se perd pas.

## Le sens : un cycle

Le coffre, c'est le coffre-fort de chacun : ce qui a le plus de valeur y
reste. Le reste circule : on vend, l'argent revient, il sert à acquérir
autre chose, qui circulera à son tour. Tiroir veut rendre ce cycle
**écologique et économique**, en remettant en valeur la **matière
première** d'un objet (pour un vêtement : la matière, la fabrication).

- Le **prix proposé par l'IA** tient compte de la matière et de l'**usure**,
  pour être à peu près juste.
- **Gratuit jusqu'à 20 objets** (décision du fondateur, 30/09/2026 ; grille
  complète : `strategie/offres.md`).

## Retrouver à la voix (30 septembre 2026)

Idée du fondateur, née d'une partie de cache-cache : on retrouve un objet
**par étapes**, comme on le cherche dans sa tête — la pièce (« au
grenier »), puis le contenant (« la valise n° 3 »), puis l'objet (« la
boîte à musique »).

- L'utilisateur demande à voix haute : « Où est ma boîte à musique ? ».
  L'assistant de l'app (Nicolas ou Chloé, pas Torix, qui reste privé)
  répond avec l'emplacement enregistré : « Au grenier, dans la valise
  n° 3. »
- S'il ne sait pas quel objet on cherche, il pose des questions simples,
  par oui ou non ou par choix (« Plutôt au grenier ou au salon ? »), et
  resserre à chaque réponse, comme au cache-cache.
- Il s'appuie sur l'emplacement en briques (`location_note`) et sur les
  contenants numérotés : plus les contenants sont renseignés, plus il
  retrouve vite.
- Voix : reconnaissance et synthèse du téléphone, comme le micro de Torix.

## À décider au moment de coder

- Contenant dans un contenant (une valise dans une malle) : oui ou non ?
- L'étiquette QR : imprimée depuis l'app, ou commandée ?
- Le détail « matière » d'un vêtement : saisi, ou reconnu par l'IA sur la
  photo de l'étiquette de composition ?
