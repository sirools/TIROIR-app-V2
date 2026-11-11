# Jour J — mardi 24 novembre 2026, « Noël avant Noël »

Objectif du matin : **le premier palier (1 000 €) dans les premières heures**,
pour qu'Ulule mette le projet en avant.

Adresses :
- Page : https://fr.ulule.com/tiroir-app/
- Admin campagne : https://backoffice.tiroir.app/admin/ulule
- Site : https://tiroir.app

## La veille, lundi 23

- [ ] Page Ulule validée par la relecture, prête à publier.
- [ ] `/admin/ulule` → Réglages : lancement `24/11/2026 08:00`. Si tu publies
      plus tard que 8 h, mets l'heure réelle : avant cette heure, les liens
      affichent « Rendez-vous », après, ils envoient sur Ulule. Une page pas
      encore publiée renverrait une erreur.
- [ ] Un envoi test de l'e-mail « C'est parti » reçu sur ta boîte, lu sur
      téléphone.
- [ ] La liste des proches et leurs liens perso prêts à copier
      (`tiroir.app/u/<slug>`, slug visible dans l'admin), avec le message validé.
- [ ] Téléphone chargé, réveil, notifications Ulule activées.

## Le matin, dans cet ordre

**7 h 45 — avant de publier**
1. Ouvrir l'admin : la date de lancement affichée est bien le 24 à 8 h.
2. Ouvrir un lien perso (le tien) en navigation privée : « Rendez-vous le
   24 novembre ». Normal à cette heure-là.

**8 h 00 — publier**
3. Sur Ulule, cliquer « Publier ma collecte ». Rien n'est automatique.
4. Ouvrir https://fr.ulule.com/tiroir-app/ en navigation privée : la page est
   publique, le bouton de contribution marche.

**8 h 05 — vérifier les liens**
5. Rouvrir ton lien perso : il arrive sur Ulule, avec `utm_source=<ton slug>`
   dans l'adresse.
6. Sur https://tiroir.app, descendre d'un écran : la bannière apparaît, son
   bouton mène à Ulule.
7. Dans l'admin, le clic de l'étape 5 apparaît.

**8 h 10 — envoyer**
8. Admin → envoyer l'e-mail « C'est parti » aux ambassadeurs.
9. Envoyer le message aux proches, **chacun avec son lien perso** :

   > Coucou ! Le 24 novembre, je lance la campagne Ulule de Tiroir, l'app que
   > je construis depuis des mois en hommage à mamie. Les premières heures
   > comptent énormément : si on atteint le premier palier dès le matin, Ulule
   > met le projet en avant. Est-ce que tu pourrais contribuer le 24, même un
   > petit montant, et dès que tu reçois le lien ? Merci du fond du cœur, ça
   > compte énormément pour moi. Clément

   Envoyé le 24 au matin, le message gagnerait à dire « Aujourd'hui » plutôt
   que « Le 24 novembre » : à toi de voir.
10. Bio Instagram : mettre le lien `tiroir.app/u/instagram`
    (créé par la PR #105 ; sans elle, mets l'adresse Ulule). Publier le post
    et la story du lancement.

**8 h 30 → 12 h — suivre**
11. Toutes les heures : montant sur Ulule, clics dans l'admin. Relancer en
    direct ceux qui ont cliqué sans contribuer, pas les autres.
12. Palier 1 000 € atteint : story « premier palier, merci », et un mot aux
    ambassadeurs.

**Le soir**
13. Ulule → exporter les contributions (CSV). Admin → Import : regarder
    l'aperçu (colonnes reconnues, commandes payées), puis valider. Les mercis
    partent aux nouveaux contributeurs seulement.
14. Si l'aperçu refuse le fichier : ne rien forcer. Noter les colonnes
    affichées et me les envoyer, je corrige l'import le lendemain matin. Les
    mercis partiront avec un jour de retard, pas en double.

## Les jours suivants

- **Chaque soir** : export Ulule puis import dans l'admin (mercis).
- **Vendredi 4 décembre** : e-mail de relance mi-campagne.
- **Dimanche 13 décembre** : e-mail « dernières 48 h », cadeaux à offrir avant
  Noël.
- **Mardi 15 décembre** : clôture. Dernier import le soir.
- **Mercredi 16 décembre** : e-mail de bilan et de remerciement à tous.

## Si quelque chose casse

| Problème | Que faire |
|---|---|
| Les liens perso affichent encore « Rendez-vous » | Admin → Réglages : mettre l'heure de lancement à maintenant. Effet immédiat, sans redéploiement. |
| tiroir.app ou les liens perso ne répondent plus | Envoyer directement https://fr.ulule.com/tiroir-app/ (le suivi par personne est perdu, la collecte non). |
| Un e-mail est parti en échec | Admin → « Relancer les échecs ». Ce qui est parti ne repart pas. |
| E-mails en spam | Prévenir les proches par SMS, avec le lien. Me signaler l'adresse qui les a reçus en spam. |
| L'import refuse l'export Ulule | Voir l'étape 14. Les contributions restent sur Ulule, rien n'est perdu. |
| Quelqu'un demande à être effacé | Admin → Effacer. Son adresse sera écartée des imports suivants. |
