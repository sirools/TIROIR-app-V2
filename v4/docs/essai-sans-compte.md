# Essai sans compte et type de profil — choix techniques et points ouverts

14 novembre 2026 · branche `claude/determined-einstein-04zpzh` · rien n'est
appliqué en base, rien n'est déployé.

## Ce qui est livré

| Livrable | Où | Vérifié par |
| --- | --- | --- |
| Essai sans compte du site : photo → estimation Torix → emplacement → création du compte → objet rattaché | `web/pages/essai/`, `web/pages/api/essai/`, `web/lib/trial*.ts` | `v4/e2e/essai/run.sh` : 27 vérifications dans un navigateur |
| Bouton « Range ton premier objet » sur la page d'accueil | `web/components/home/Hero.tsx` | idem |
| Estimation et nettoyage | `supabase/functions/trial-estimate`, `trial-cleanup` | relus, **non exécutés** (pas de Deno ici) |
| Migration : `profiles.user_profile`, essais, plafonds, rattachement, tâche de nettoyage | `supabase/drafts/essai_sans_compte.sql` | `supabase/drafts/tests/run_essai.sh` : 52 tests, rejouable |
| Question du profil, un tap : site (après la sauvegarde, sur l'accueil, dans Profil) et app (premier lancement, Paramètres) | `web/components/account/ProfileTypeChoice.tsx`, `mobile/app/(app)/profile-type.tsx` | site : banc e2e ; app : `tsc`, **pas vue sur appareil** |
| Ton tu / vous selon le profil | `web/lib/userProfile.ts` (`toned`), `mobile/src/i18n/tone.ts` (`tt`) | `web/__tests__/trial.test.ts` ; repli i18next vérifié dans les 6 langues |
| Textes : site fr, en, es, de ; app fr, en, es, de, pt-BR, pt-PT | `design/i18n/` | `i18n-check`, `generate.mjs --check` |

## Choix techniques

1. **Pas de compte anonyme Supabase.** La piste du brief est écartée : un
   compte anonyme porte le rôle `authenticated`, donc toutes les règles
   « `auth.uid() = user_id` » et tous les quotas IA gratuits s'ouvrent à qui
   en fabrique à la chaîne ; il faudrait revoir chaque fonction IA, et
   refaire l'inscription (conversion de compte, liaison Google). À la
   place : une table `trial_objects` sans aucune règle d'accès, lue et
   écrite par le serveur seul, et un cookie illisible par la page. Aucune
   règle existante ne change.
2. **L'objet suit le compte par deux chemins.** Le cookie (même
   navigateur) ; et un code de rattachement rangé dans les métadonnées à
   l'inscription, pour un e-mail confirmé sur un autre appareil. Une
   inscription en attente garde l'essai 7 jours au lieu de 48 h. Le
   rattachement (`claim_trial_object`) est atomique et rejouable.
3. **Coût borné en base, pas dans le code.** Un essai par navigateur, deux
   tentatives au plus (la seconde seulement si la première n'a rien
   donné), 3 essais par adresse IP et par 24 h, 300 essais par jour tous
   visiteurs confondus — réglables dans `app_settings`, arrêt d'urgence
   `trial_enabled = false`. Pire cas par défaut : 600 appels Haiku par jour.
4. **Estimation de l'essai : Haiku 4.5, une image, sans recherche web**
   (~0,3 c estimé, quelques secondes). L'estimation avec annonces (Sonnet +
   recherche web, 5 à 10 c) reste réservée aux comptes. La fourchette de
   l'essai est annoncée comme indicative ; elle devient l'estimation de la
   fiche à la création du compte (`value_sources.origin = 'trial'`).
5. **La clé du fournisseur d'IA reste dans Supabase.** Le site appelle la
   fonction Edge avec la clé service ; le site n'a toujours pas de clé
   Anthropic.
6. **RGPD.** Photo réduite et réencodée dans le navigateur (les données de
   prise de vue ne partent pas), adresse IP gardée seulement en empreinte
   salée, suppression de la photo et de la ligne à l'expiration, mention
   avant l'envoi et date de suppression après. Des compteurs par jour
   (`trial_daily_stats`), sans donnée de visiteur, survivent au nettoyage.
7. **`user_profile` à côté de `persona`.** Trois valeurs (`personal`,
   `creative`, `business`) ; le métier précis reste dans Profil. Un compte
   qui a déjà un métier reçoit son type sans question. **La liste des
   métiers est retirée du formulaire d'inscription** (posée la veille) :
   la règle « une seule question » l'emporte.
8. **Ton.** Une section qui existe aux deux tons porte ses textes au
   vouvoiement sous `formal`, repli sur le texte commun. Aujourd'hui :
   accueil du site, question du profil, et côté app l'accueil et
   Paramètres. Le reste de l'espace connecté est encore au tutoiement.

## Mettre en preprod

1. Supabase de preprod (vérifier le `link`) : jouer
   `supabase/drafts/essai_sans_compte.sql`.
2. `supabase functions deploy trial-estimate trial-cleanup`.
3. Poser l'adresse du nettoyage dans le Vault (commande en bas du SQL) ;
   vérifier que le secret `lifecycle_cron` existe sur la preprod.
4. Déployer le site sur le NAS (`preprod/deploy.sh`). Aucune nouvelle
   variable ; `TRIAL_SALT` est facultative.
5. Ouvrir `/essai` depuis un téléphone.

Tant que le SQL n'est pas joué, le site reste sain : la question du profil
ne s'affiche pas, et `/essai` répond « l'estimation n'a pas abouti ». **Ne
pas fusionner dans `main` avant d'avoir joué le SQL en prod**, sinon le
bouton de la page d'accueil mène à cet échec.

## Points ouverts

- **Qualité de l'estimation sans recherche web** : à juger sur de vrais
  objets en preprod. Si elle déçoit, passer à Haiku + recherche web
  (~3 c, 15 à 30 s) est un changement dans `trial-estimate` seul.
- **Coût réel** : à lire dans `trial_daily_stats.cost_usd` ; il n'apparaît
  pas encore dans le tableau de bord ni dans l'alerte de dépense
  (`ai_usage` exige un compte).
- **Captcha** : aucun. Les plafonds bornent le coût, pas le bruit ; un
  Turnstile s'ajoute devant `/api/essai/estimer` si la preprod en montre
  le besoin.
- **Politique de confidentialité** : elle ne mentionne pas encore l'essai
  (photo d'un visiteur sans compte, 48 h, sous-traitant Anthropic). Texte
  contractuel : à valider par le fondateur avant la prod.
- **E-mails de confirmation** : le lien renvoie bien vers la sauvegarde,
  mais le texte de l'e-mail (tableau de bord Supabase) ne parle pas de
  l'objet qui attend.
- **Vouvoiement** : à étendre écran par écran (collections, fiche, ventes,
  partages ; e-mails). Le portugais de l'app n'a pas de variante : ses
  textes actuels sont déjà à la forme de politesse.
- **App** : écran et réglage non vus sur appareil ; pas d'essai sans compte
  dans l'app (hors brief).
- **Analytics** : `profiles.user_profile` et `trial_daily_stats` sont en
  base ; aucun écran du back-office ne les montre encore.
