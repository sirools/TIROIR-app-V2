# Parrainage depuis un lien de partage — à cadrer (non codé)

Idée notée le 28 septembre 2026, pour une version **après** les suggestions.

## L'idée

Depuis la page d'un partage (public ou protégé), inviter à rejoindre Tiroir
avec un **code de parrainage**. Quand le code a fait venir **2 à 3
personnes**, le parrain passe de **gratuit à Premium pour un mois**.

Le partage est la seule surface de Tiroir vue par des non-inscrits : c'est
l'endroit naturel pour la boucle de croissance (voir « boucle produit de
partage ou referral » dans `agents/GROWTH_WAR_ROOM.md`).

## Parcours pressenti

1. Chaque compte a un code court (ex. `CLEM-7K2Q`), visible dans son profil.
2. Un lien de partage porte le code de son propriétaire : le bandeau
   « Créez votre inventaire personnel » en bas de `/s/[token]` devient
   « Rejoignez Tiroir avec l'invitation de Clément ».
3. Le visiteur s'inscrit (web ou app) : le code est retenu, via le lien ou
   saisi à la main.
4. Un parrainage devient **valide** quand le filleul a confirmé son e-mail
   et ajouté un premier objet (garde-fou contre les faux comptes).
5. Au 2ᵉ ou 3ᵉ parrainage valide : un mois Premium offert au parrain, avec
   une notification.

## Contrainte technique : comment l'app sait qui est Premium

- L'app installée lit `profiles.plan` (`free` / `premium` / `pro`) et
  l'utilise directement (`isPaidPlan`). On ne peut pas lui apprendre une
  nouvelle règle sans nouvelle version.
- Le webhook RevenueCat écrit `profiles.plan` : il passe à `premium` à
  l'achat et à `free` à l'expiration. Les comptes `pro` sont déjà protégés
  (`.neq('plan', 'pro')`).

D'où la piste recommandée :
- `profiles.referral_premium_until` (date) ; à l'octroi, `plan = 'premium'`.
- Tâche planifiée (pg_cron existe déjà, cf. e-mails de cycle de vie) : à
  échéance, `plan = 'free'` **seulement si** aucun abonnement RevenueCat
  n'est actif.
- Webhook RevenueCat : ne pas rétrograder pendant un mois offert en cours.
- Alternative à étudier : les *promotional entitlements* de RevenueCat
  (octroi par API), qui gardent RevenueCat seul maître du statut.

## Données envisagées

- `referral_codes (user_id, code UNIQUE)`
- `referrals (referrer_id, referee_id UNIQUE, source_share_link_id, status
  pending|valid|rejected, created_at, validated_at)`
- `referral_rewards (user_id, months, granted_at, until)`

## Questions à trancher

- Seuil : 2 ou 3 filleuls ? Cumulable (chaque palier = un mois de plus),
  avec un plafond ?
- Le filleul gagne-t-il quelque chose (ex. un mois lui aussi) ?
- Déjà abonné : mois reporté à la fin de l'abonnement, ou rien ?
- Qu'est-ce qu'un parrainage valide (inscription seule, e-mail confirmé,
  premier objet) ?
- Visible sur tous les partages, ou réglable par le propriétaire (comme les
  suggestions) ?
- Contraintes App Store : un avantage in-app offert contre des invitations
  doit rester conforme aux règles d'Apple (à vérifier avant de coder).
