# Tiroir — repères pour les sessions de travail

Monorepo : `mobile/` (app Expo, voir `mobile/CLAUDE.md`), `web/` (Next.js,
Pages Router, déployé sur Vercel), `supabase/` (migrations et Edge
Functions), `v4/` (prochaine version, qui porte aussi ce qui devait être
la V5), `agents/`, `strategie/`.

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
Lab est `/admin/torix-lab`, ouvert à tous les comptes admin (décision du
fondateur du 2026-09-29), jamais aux comptes Gratuit, Premium ou Pro :
`requireTorixPage` (`web/lib/adminAuth.ts`). Toute nouvelle page de Torix
doit passer par cette garde. Ce qui engage les secrets ou l'argent du
fondateur (par exemple le futur cerveau qui code) passe par
`requireTorixOwnerPage`, qui exige en plus l'adresse confirmée de
`TORIX_OWNER_EMAIL` (`web/lib/torixOwner.ts`).

Ce que Torix sait de Tiroir est dans `web/components/torix/knowledge.ts`
(fiches sans modèle, avec registre et source). **Tout changement de modèle,
de tarif, de quota ou de fonction IA doit mettre ces fiches à jour** — le
test `web/__tests__/torixKnowledge.test.ts` les compare au code et casse
sinon.
