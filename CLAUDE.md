# Tiroir — repères pour les sessions de travail

Monorepo : `mobile/` (app Expo, voir `mobile/CLAUDE.md`), `web/` (Next.js,
Pages Router, déployé sur Vercel), `supabase/` (migrations et Edge
Functions), `v4/` (prochaine version), `agents/`, `strategie/`.

## Documents de référence à lire avant de décider

- `strategie/torix-et-tiroir.md` — relation Torix / Tiroir, coûts IA,
  passage à l'échelle, rythme des phases, gouvernance, qui contacter.
  **À relire avant tout changement touchant aux appels IA, aux
  fournisseurs, aux quotas, ou aux accès admin.**
- `agents/ROADMAP.md` — produit.

## Torix

Torix est l'IA du fondateur (voir `web/components/torix/ownership.ts`),
pilotée par lui seul. Ses principes vivent dans `web/components/torix/` :
`memory.ts` (structure narrative, registres), `commandments.ts` (douze
commandements, repos obligatoire 21 h 30 – 7 h), `ownership.ts`. Le Torix
Lab est `/admin/torix-lab`, derrière `web/lib/adminAuth.ts`.
