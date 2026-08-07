# Templates e-mail Tiroir

Quatre gabarits, un par public. Autonomes : chacun s'ouvre seul dans un
navigateur et se colle tel quel dans un routeur.

| Fichier | Public | Intention |
|---|---|---|
| `presentation.html` | **Tous — premier envoi** | Se présenter à quelqu'un qui ne connaît pas le produit |
| `investisseurs.html` | Investisseurs, business angels | Point d'étape mensuel — chiffres, ce qui a bougé, ce qui inquiète, la demande |
| `utilisateurs.html` | Utilisateurs déjà inscrits | Annonce de fonctionnalité — une seule idée, un seul bouton |
| `collectionneurs.html` | Segment collection | Acquisition — la valeur d'un inventaire documenté |
| `vendeurs.html` | Revendeurs Vinted / leboncoin | Acquisition — le temps gagné avant mise en ligne |

**`presentation.html` part en premier**, avant les quatre autres : ils
supposent tous que le lecteur sait ce qu'est Tiroir.

## Le premier envoi n'est pas un envoi comme les autres

Une liste qui n'a jamais reçu de courrier n'a **aucune réputation**
auprès des fournisseurs de messagerie. Le premier message est donc le
plus exposé — et une plainte pour spam abîme le domaine expéditeur bien
plus durablement qu'une désinscription.

D'où trois choix propres à `presentation.html` :

- **« Pourquoi vous recevez ceci » figure en haut**, dans le corps du
  texte, et pas seulement au pied de page.
- **Le message est signé par une personne**, avec réponse ouverte. Une
  première prise de contact anonyme n'a aucune raison d'être lue.
- **La fréquence est annoncée** — « au plus un message par mois ». C'est
  un engagement&nbsp;: l'annoncer réduit fortement les désinscriptions,
  ne pas le tenir les multiplie. Ajuster la phrase plutôt que la retirer.

Deux précautions d'envoi qui ne relèvent pas du gabarit :

1. **Monter en charge progressivement.** Quelques centaines d'adresses
   par jour plutôt que toute la base d'un coup. Un pic depuis un domaine
   sans historique est le motif de filtrage le plus courant.
2. **Nettoyer la liste avant.** Les comptes créés il y a longtemps
   contiennent des adresses mortes&nbsp;; un taux de rebond élevé au
   premier envoi coûte cher et se rattrape lentement.

## Pourquoi du HTML de 2005

Les clients mail ne sont pas des navigateurs. Outlook rend le HTML avec
le moteur de **Word**, Gmail réécrit le `<head>`, et une bonne part des
lecteurs ignorent les feuilles de style. D'où des choix qui paraissent
archaïques et qui sont en réalité les seuls qui tiennent :

- **Tableaux pour la mise en page**, jamais flex ni grid. Word ne connaît
  ni l'un ni l'autre.
- **Styles en ligne sur chaque élément.** Ce qui est dans `<style>` est
  un bonus, pas un acquis : Gmail le conserve dans l'onglet Promotions et
  le jette ailleurs. Tout ce qui compte est dupliqué en `style="…"`.
- **Pas de police web.** La pile s'appuie sur les polices système ;
  `Inter` n'y est que pour les rares clients qui l'ont déjà.
- **Images en absolu**, jamais en `cid:` ni en base64 — Gmail refuse le
  base64 dans les balises `<img>`.
- **600 px de large.** Au-delà, Outlook coupe.

## Les colonnes ne sont pas des cellules

C'est le point le moins intuitif du lot, et il a coûté une correction.

La recette courante consiste à poser deux `<td>` côte à côte et à les
basculer en `display:block` sous une requête média. **Elle ne marche
pas** : un `<td>` passé en bloc reste enfant d'une ligne de tableau, sa
largeur `100 %` se résout donc contre une boîte anonyme, et les colonnes
s'empilent en gardant leur demi-largeur. Mesuré ici : 158 px au lieu de
327, avec débordement horizontal.

Les colonnes sont donc des `<div>` **en ligne** à `max-width` bornée.
Elles passent à la ligne toutes seules quand la place manque, ce qui a
deux conséquences heureuses :

1. **aucune requête média n'est nécessaire** — la mise en page tient donc
   aussi dans les clients qui suppriment la balise `<style>` ;
2. Outlook, qui ignore `inline-block`, retrouve un vrai tableau grâce aux
   commentaires conditionnels `<!--[if mso]>`.

Le conteneur porte `text-align:center` et chaque bloc rétablit
`text-align:left`. Sans ça, un bloc borné à 260 px sur un écran de 375
laisse tout son jeu du même côté.

## Le mode sombre demande des couleurs à lui

Deux corrections faites après contrôle, symptomatiques du piège :

- le **vert de marque** `#2D5016`, conçu pour du texte sur fond clair,
  devient illisible sur fond sombre. Les variations chiffrées — la seule
  information de tendance du point d'étape — disparaissaient ;
- le bloc **« Avec Tiroir »** de `vendeurs.html` tire tout son sens de son
  opposition au bloc « Avant ». En clair, le presque-noir tranche sur la
  crème. En sombre, les deux tombaient dans la même famille de bruns.

Une couleur ne se contente pas d'être inversée : elle doit être
**rechoisie** dès qu'elle porte du sens.

## Ce qui est volontairement absent

**Aucun SVG.** Le logo est servi en PNG (`/icons/app-icon.png`) alors
qu'un `/logo-tiroir.svg` existe : Gmail, Outlook et Yahoo ne rendent pas
le SVG dans un e-mail. Un logo vectoriel y serait un carré vide.

**Aucun chiffre en dur.** Tout ce qui est factuel passe par une variable.
Un e-mail investisseurs avec des chiffres inventés est pire qu'un e-mail
sans chiffres : voir la liste des variables plus bas.

**Le mode sombre est traité, sans garantie.** Les règles
`prefers-color-scheme` couvrent Apple Mail et Outlook récent. Gmail
applique sa propre inversion, qu'on ne contrôle pas. Les gabarits sont
donc conçus pour rester lisibles **même mal inversés** : jamais de texte
clair sur fond clair une fois retourné.

## Variables

Syntaxe `{{ }}` (Brevo, Mailjet, Customer.io, Postmark). Pour Mailchimp,
convertir en `*|VARIABLE|*`.

Communes à tous les gabarits :

| Variable | Exemple |
|---|---|
| `{{prenom}}` | `Camille` — prévoir une valeur par défaut, voir plus bas |
| `{{lien_desinscription}}` | fourni par le routeur |
| `{{lien_preferences}}` | page de gestion des envois |
| `{{adresse_postale}}` | obligatoire, voir « Conformité » |

Propres à `investisseurs.html` — **toutes à renseigner, aucune valeur par
défaut n'a de sens ici** :

`{{periode}}`, `{{comptes}}`, `{{comptes_delta}}`, `{{actifs_30j}}`,
`{{actifs_delta}}`, `{{objets}}`, `{{objets_delta}}`, `{{mrr}}`,
`{{mrr_delta}}`, `{{fait_1..3}}`, `{{vigilance}}`, `{{demande_1..2}}`,
`{{lien_rdv}}`.

### Le piège du prénom

`Bonjour {{prenom}},` devient `Bonjour ,` quand le champ est vide — et il
l'est toujours pour une partie de la base. Deux réponses possibles :
définir une valeur par défaut au niveau du routeur, ou couper l'accroche
du prénom. Les gabarits utilisent la forme `{{prenom|Bonjour}}` là où le
routeur la gère ; sinon, retirer la ligne.

## Conformité

Le pied de page porte le **lien de désinscription** et l'**adresse
postale** de l'expéditeur. Les deux sont exigés : par le RGPD et la
directive ePrivacy en Europe, par le CAN-SPAM aux États-Unis. Un envoi
sans l'un des deux est une infraction, pas une négligence de forme — et
les fournisseurs de messagerie s'en servent comme signal de spam.

`investisseurs.html` est un e-mail **relationnel**, pas commercial : la
désinscription y reste, mais sans le vocabulaire marketing.

## Avant chaque envoi

1. **Tester le rendu réel** (Litmus, Email on Acid, ou simplement
   s'envoyer le message sur Gmail web, Gmail iOS, Apple Mail et Outlook).
   Le rendu navigateur ne prouve rien.
2. **Vérifier le pré-en-tête** — la ligne cachée en haut du corps, qui
   s'affiche à côté de l'objet dans la boîte de réception. Laissée vide,
   le client y met les premiers mots du HTML, souvent « Voir ce message
   dans un navigateur ».
3. **Cliquer chaque lien** une fois les variables résolues.
4. **Peser le fichier.** Au-delà de 102 Ko, Gmail tronque le message et
   coupe le pied de page — donc la désinscription.
