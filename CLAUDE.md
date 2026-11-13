# Tiroir — repères pour les sessions de travail

Monorepo : `mobile/` (app Expo, voir `mobile/CLAUDE.md`), `web/` (Next.js,
Pages Router, déployé sur Vercel ; le back-office a son propre domaine,
`backoffice.tiroir.app`, voir `web/BACKOFFICE.md`), `supabase/` (migrations et Edge
Functions), `v4/` (prochaine version, qui porte aussi ce qui devait être
la V5), `agents/`, `strategie/`, `torix-mac/` (prototype de Torix pour
Mac, appli macOS native 100 % locale ; jamais compilé hors d'un Mac, voir
`torix-mac/RAPPORT.md` et `torix-mac/DECISIONS.md`).

## Adresses à donner au fondateur

À chaque sortie, les adresses d'admin se donnent sur
`https://backoffice.tiroir.app` (back-office, Torix Lab :
`https://backoffice.tiroir.app/admin/torix-lab`), **jamais** sur
`tiroir.app/admin`. Le site public, `https://tiroir.app`, ne sert qu'aux
pages publiques (partages `/s/<jeton>`, `/mes-partages`…).

## Design system

Seule source de vérité : `design/tokens.json` (le site web actuel fait
foi). Jamais de couleur ni de police décidée ailleurs : modifier le
fichier, puis `node design/generate.mjs`. Voir `design/README.md`.

Traductions : seule source `design/i18n/` (textes de l'app, du site et
des e-mails, liste des langues). Jamais de texte modifié dans
`mobile/src/i18n/locales`, `web/locales`, `_shared/emailCopy.generated.ts`,
`_shared/emailPresentation.ts` ni `marketing/emails/presentation.html`
(générés) : modifier `design/i18n/` (ou le gabarit
`marketing/emails/gabarits/`), puis
`node design/generate.mjs` et `node scripts/i18n-check.mjs`. Voir
`design/i18n/README.md`.

## Langues et ton du site

Langues de Tiroir : **fr, en, es, de, pt**. Le site (tiroir.app) sert fr,
en, es et de ; le portugais n'existe encore que dans l'app. Aucune autre
langue sans décision du fondateur.

Ton : **tutoiement** pour tout ce qui s'adresse au grand public (offre
gratuite) ; **vouvoiement** pour tout ce qui concerne Premium, Pro et
Business. Vaut pour chaque langue qui distingue les deux (tu/vous, tú/usted,
du/Sie, tu/o senhor). Classement texte par texte : `web/locales/README.md` (les textes eux-mêmes
vivent dans `design/i18n/`).

## Documents de référence à lire avant de décider

- `strategie/torix-et-tiroir.md` — relation Torix / Tiroir, coûts IA,
  passage à l'échelle, rythme des phases, gouvernance, qui contacter.
  **À relire avant tout changement touchant aux appels IA, aux
  fournisseurs, aux quotas, ou aux accès admin.**
- `strategie/torix-cerveau.md` — donner un vrai cerveau à Torix pour coder
  la V4 : décisions à prendre avant tout code.
- `agents/ROADMAP.md` — produit.

## Torix

Torix est l'IA du fondateur (voir `web/components/torix/ownership.ts`),
pilotée par lui seul. Ses principes vivent dans `web/components/torix/` :
`memory.ts` (structure narrative, registres), `commandments.ts` (douze
commandements, repos obligatoire 21 h 30 – 7 h), `ownership.ts`, `voice.ts`
(micro et réponse à voix haute, par le navigateur, sans modèle). Le Torix
Lab est `/admin/torix-lab`, réservé au propriétaire de Torix — pas à tous
les admins (un collègue peut être admin du back-office sans voir Torix) :
`requireTorixOwnerPage` (`web/lib/adminAuth.ts`), qui compare l'adresse
confirmée du compte à la variable serveur `TORIX_OWNER_EMAIL`
(`web/lib/torixOwner.ts`) — à défaut, à `DEFAULT_OWNER_EMAIL`, l'adresse du
fondateur, écrite côté serveur seulement. Toute
nouvelle page ou API de Torix doit passer par cette garde.

**Le savoir de Torix ne part jamais dans le navigateur** : le code d'une
page Next est un fichier public, téléchargeable sans connexion. Les fiches
(`knowledge.ts`, `directions.ts`, `memory.ts`, `ownership.ts`, et `savoir.md`,
le savoir de Clément) ne sont lues
que par le serveur — `/api/torix/ask`, gardée par `requireTorixOwnerApi`.
Le test `web/__tests__/torixPrive.test.ts` casse si une page les importe.

Ce que Torix sait de Tiroir est dans `web/components/torix/knowledge.ts`
(fiches sans modèle, avec registre et source). **Tout changement de modèle,
de tarif, de quota ou de fonction IA doit mettre ces fiches à jour** — le
test `web/__tests__/torixKnowledge.test.ts` les compare au code et casse
sinon.
