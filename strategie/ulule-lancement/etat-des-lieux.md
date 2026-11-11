# Campagne Ulule — état des lieux au 11 novembre 2026

Lancement le **mardi 24 novembre 2026**, clôture le **mardi 15 décembre**.
Accroche : **« Noël avant Noël »**. Page : https://fr.ulule.com/tiroir-app/
(projet n° 240562). Paliers : 1 000 €, 2 000 €, 5 000 €.

**Mode de collecte : dons** (décision du 11 novembre, sur proposition
d'Ulule). Pas de contreparties, pas de tout ou rien : chaque don est acquis,
l'objectif et la date de fin sont facultatifs (on garde le 15 décembre pour
l'élan), et l'argent se vire à la demande. La commission d'Ulule s'applique à
tout ce qui est viré. Tiroir n'étant pas une association, pas de reçu fiscal.
Les paliers restent des caps affichés sur le site et dans les e-mails.

Ce document compare ce qui est en place (PR #101 et #103, fusionnées sur
`main`) à la checklist du brief, puis liste ce qui reste à faire avant le 18.

## 1. Ce qui est en place

Vérifié le 11 novembre dans le code de `main`, sur la base de prod et dans
les DNS.

| Élément | État | Où |
|---|---|---|
| Tables ambassadeurs, clics, contributions, journal des e-mails, effacements | **En prod** (migration appliquée), toutes vides | `supabase/migrations/20261111120000_campagne_ulule.sql` |
| Lien perso `tiroir.app/u/<slug>` : enregistre le clic, page de rendez-vous avant le lancement, redirection Ulule + UTM après | Fusionné, déployé | `web/pages/u/[slug].tsx` |
| Admin : ambassadeurs, clics et contributions par personne, envoi, import, effacement — propriétaire seul | Fusionné | `https://backoffice.tiroir.app/admin/ulule` |
| E-mail de pré-lancement avec lien perso et désinscription en un clic (`List-Unsubscribe`) | Fusionné ; test reçu le 11/11 | `web/lib/ululeEmails.ts`, textes `design/i18n/email/fr.json` |
| Merci après contribution : une seule fois par adresse, commandes payées seulement | Fusionné, testé en local | `ulule_next_recipients`, contrainte `UNIQUE (kind, recipient_email)` |
| Import CSV de l'export Ulule avec aperçu (le plan de secours du brief) | Fusionné, testé avec un faux fichier | `/admin/ulule`, onglet import |
| Bannière Ulule sur l'accueil (FR et EN), passe par `/u/accueil` | Fusionnée, déployée | `web/components/UluleInvite.tsx` |
| Fournisseur d'e-mails : Resend, domaine authentifié | **OK** : DKIM `resend._domainkey`, SPF et MX sur `send.tiroir.app`, DMARC présent (`p=none`) | DNS |

### Ce qu'Ulule permet vraiment (vérifié)

- **Webhooks** : réservés aux partenaires. Pas pour nous.
- **API privée** : ne donne pas l'e-mail des contributeurs → le merci ne peut
  pas être automatique à la seconde.
- **API publique** : `https://api.ulule.com/v1/projects/<id>` répond **sans
  clé** pour un projet en ligne (testé sur un autre projet : `amount_raised`,
  `goal`, `goal_raised`, `nb_products_sold`). Pour 240562 elle répond 401
  aujourd'hui, normal tant que la page n'est pas publiée. → **une jauge en
  direct sur tiroir.app est possible à partir du 24**, sans import.
- **Export CSV** : seule source pour les e-mails des contributeurs. C'est le
  circuit retenu : import une fois par jour depuis l'admin, qui envoie les
  mercis aux nouveaux contributeurs seulement.

## 2. Écarts trouvés

Classés par gravité.

1. **La date de lancement en base est le 12 janvier 2027 à 8 h.** L'e-mail de
   pré-lancement dirait « Le 12 janvier », la page de rendez-vous aussi, et
   les liens ne redirigeraient vers Ulule qu'en janvier. À changer dans
   `/admin/ulule` → Réglages **avant tout envoi** : `24/11/2026 08:00`.
2. **Les liens de la bannière et d'Instagram ne sont pas suivis.** `/u/accueil`
   n'enregistre un clic et n'ajoute les UTM que si « accueil » existe comme
   ambassadeur. Aujourd'hui, aucun ambassadeur n'existe.
3. **Un proche sans e-mail ne peut pas avoir de lien.** L'e-mail est
   obligatoire et unique, et tout ambassadeur ajouté reçoit le pré-lancement au
   prochain envoi groupé. Or le brief veut un lien par proche ou par famille,
   envoyé par SMS par Clément.
4. **Il n'existe que deux e-mails** (pré-lancement, merci). Manquent :
   lancement « C'est parti », relance mi-campagne, dernières 48 h, bilan. La
   base n'accepte que `prelaunch` et `thanks` (contrainte `CHECK`).
5. **La bannière ne dit rien de Noël ni des paliers**, et n'a pas de jauge.
   Elle n'apparaît qu'après un écran de défilement et seulement en FR et EN.
6. **Les documents de campagne datent de l'ancien calendrier** :
   `campagne-kkbb/ulule-v2.md`, `checklist.md`, `faq.md` parlent d'un
   lancement le 12 janvier, d'une fin le 9 février, d'un objectif de 4 000 €
   en tout ou rien et de contreparties livrées en février 2027. Avec la
   collecte de dons, `contreparties.md` ne sert plus, et la description, la
   FAQ (« Et si l'objectif n'est pas atteint ? ») et le texte « C'est tout ou
   rien » de `ulule-v2.md` sont à réécrire. Calendrier : 24 nov. → 15 déc.,
   paliers 1 000 / 2 000 / 5 000.
7. **URL de campagne en variable d'environnement** : le brief la demande. Elle
   est aujourd'hui en base (modifiable depuis l'admin, sans redéploiement),
   avec `https://fr.ulule.com/tiroir-app/` écrite en dur comme secours dans
   `/u/[slug]`. Je recommande de garder la base comme source et d'ajouter
   `ULULE_PAGE_URL` seulement comme secours, à la place de l'URL en dur.
8. **`RESEND_API_KEY` sur Vercel** : le test du 11/11 est bien parti, donc la
   clé est très probablement en place. Je n'ai pas pu le vérifier (pas de CLI
   Vercel ici) : un coup d'œil dans Vercel → Settings → Environment Variables.
9. **Vrai fichier d'export Ulule jamais testé.** Les intitulés de colonnes ne
   sont pas documentés. L'aperçu refuse un fichier incomplet et montre les
   colonnes trouvées : à tester sur le premier vrai export, le 24 au soir.

## 3. Checklist du brief

| Point | État |
|---|---|
| URL Ulule configurée | ✅ en base (`ulule_campaign.page_url`) ; variable d'env. en secours à ajouter (écart 7) |
| Liste des ambassadeurs importée | ⏳ attend la liste de Clément (prénom, nom, e-mail) |
| Un lien tracké unique par ambassadeur, testé | ✅ code testé en local ; ❌ pas encore pour les proches sans e-mail ni pour l'accueil/Instagram (écarts 2, 3) |
| Fournisseur choisi, domaine authentifié | ✅ Resend, déjà utilisé par l'app ; SPF/DKIM/DMARC OK. Alternatives si besoin : Brevo, Mailjet (pas recommandé de changer à 13 jours) |
| Modèles : pré-lancement, lancement, merci, relance, 48 h, bilan | ⚠️ 2 sur 6 (écart 4) |
| Merci une seule fois, après vraie contribution | ✅ garanti par la base, testé en local |
| Désinscription dans les e-mails non transactionnels | ✅ pré-lancement ; à prévoir pour les quatre nouveaux |
| Tableau de bord réservé à Clément | ✅ `requireTorixOwnerApi` / page propriétaire |
| Lien Ulule sur tiroir.app et bio Instagram le 24 | ⚠️ bannière en place mais sans Noël ni jauge (écart 5) ; bio Instagram : Clément, le 24 |
| Test de bout en bout validé avant le 18 | ⏳ à faire le 17 (section 4) |

## 4. Reste à faire avant le 18

### Claude Code : fait dans la PR #105 (pas en prod, attend ton feu vert)

Les écarts 1 à 5 et 7 sont traités dans
https://github.com/sirools/TIROIR-app-V2/pull/105 : la migration passe la
date au 24 novembre, crée les liens `accueil` et `instagram`, ajoute les
quatre e-mails, la jauge et les paliers.

- [x] **Liens sans e-mail** : un ambassadeur peut n'avoir pas d'adresse
      (proche, famille, « accueil », « instagram ») ; il a un lien et compte
      dans le tableau de bord, mais ne reçoit aucun e-mail.
- [x] **Quatre e-mails de plus** : lancement (24 matin), relance (4 déc.),
      dernières 48 h (13 déc.), bilan (16 déc.). Même mécanique que le
      pré-lancement : envoi déclenché par Clément depuis l'admin, une fois par
      personne, désinscription. Textes dans `design/i18n/email/fr.json`, à
      valider par Clément.
- [x] **Bannière « Noël avant Noël »** : accroche, rappel « jusqu'au
      15 décembre, un don du montant que tu veux, un coup de pouce avant
      Noël », jauge et paliers
      1 000 / 2 000 / 5 000 lus sur l'API publique d'Ulule (cache 5 min,
      bannière sans jauge si l'API ne répond pas).
- [x] **Jauge et paliers dans les e-mails** de relance, 48 h et bilan (montant
      lu au moment de l'envoi).
- [x] `ULULE_PAGE_URL` en secours à la place de l'URL en dur.
- [x] Tests à jour (les dates de test sont encore le 12 janvier).
- [x] **Collecte de dons** (11 nov.) : plus aucune contrepartie promise dans
      la bannière ni les e-mails ; le merci parle d'un don ; l'import
      reconnaît « ID du don », « Montant du don », « Date du don ». Les
      intitulés réels de l'export de dons restent à vérifier le 17.

### Clément

- [ ] **Répondre à Ulule** : accord pour la collecte de dons, date de fin le
      15 décembre, objectif affiché 1 000 € (ou aucun).
- [ ] **Avant le 18** : page Ulule repassée en dons (retirer les
      contreparties, réécrire les passages « tout ou rien » et
      « remboursé »), infos bancaires, envoi en relecture (≈ 2 jours ouvrés).
- [ ] **Relire et valider la PR #105** (textes des e-mails et de la bannière),
      puis appliquer sa migration avant le déploiement. Elle met la date de
      lancement au `24/11/2026 08:00`. Sans elle, change la date à la main
      dans `/admin/ulule` → Réglages.
- [ ] Donner la **liste des 5 ambassadeurs** (prénom, nom, e-mail) et la liste
      des proches ou familles qui auront un lien (un nom suffit).
- [ ] Vérifier `RESEND_API_KEY` dans Vercel (production).
- [ ] Aligner les documents de campagne sur le nouveau calendrier (écart 6).
- [ ] **Mardi 17** : test de bout en bout (ci-dessous), puis feu vert.

### Test de bout en bout du 17 novembre

Sur la prod, avec un faux ambassadeur à l'adresse de Clément :

1. Ajouter « Test Clément » avec une adresse `+test` de Clément.
2. Envoyer un test de chaque e-mail depuis l'admin : pré-lancement, lancement,
   relance, 48 h, bilan, merci. Vérifier : boîte de réception (pas spams), lien
   perso, lien de désinscription, prénom, date « 24 novembre ».
3. Ouvrir `tiroir.app/u/test-clement` : page « Rendez-vous le 24 novembre »,
   un clic de plus dans le tableau de bord.
4. Importer un faux CSV avec une commande payée et une annulée pour cette
   adresse : un seul merci, aucun pour l'annulée. Réimporter : rien ne repart.
5. Désinscrire l'adresse, relancer un envoi : elle est écartée.
6. Effacer le faux ambassadeur et ses données.
