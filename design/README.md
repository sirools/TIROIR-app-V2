# Design system de Tiroir

**Seule source de vérité : `design/tokens.json`.** Décision du fondateur
(2026-09-29) : le site web actuel fait foi. Les couleurs, la police,
l'arrondi et l'ombre se décident ici, et nulle part ailleurs.

## Modifier un jeton

1. Changer la valeur dans `design/tokens.json`.
2. `node design/generate.mjs` — réécrit les fichiers générés.
3. Commiter le tout. Le test `web/__tests__/designTokens.test.ts` casse si
   un fichier généré n'est plus à jour ou si le site redéfinit une couleur
   à la main.

## Où ça va

| Support | Fichier généré | Branché ? |
| --- | --- | --- |
| Site web | `web/styles/tokens.generated.css` (variables CSS) | ✅ fil 1 — importé par `web/pages/_app.tsx` |
| App iOS et Android (une seule app Expo) | `mobile/src/components/ui/brandTokens.generated.ts` | ⏳ fil 2 |
| E-mails | `supabase/functions/_shared/brandTokens.generated.ts` | ⏳ fil 3 |

## La suite, fil par fil

1. ✅ **Source unique + générateur**, site branché (valeurs identiques :
   rien ne change à l'écran).
2. **App** : `tokens.ts` lit `Brand`. C'est là que l'app change de visage —
   décisions à prendre d'abord (ci-dessous).
3. **E-mails** : `emailPresentation.ts` lit `Brand`.
4. **Couleurs en dur** : remplacer, écran par écran, les centaines de
   valeurs recopiées à la main (`#F26900`, `#1A1612`…) sur le site et
   dans l'app.

## Décisions à prendre avant le fil 2

Le site et l'app divergent aujourd'hui. Le site fait foi, mais certaines
valeurs n'existent que dans l'app :

| Rôle | Site (fait foi) | App aujourd'hui | À décider |
| --- | --- | --- | --- |
| Couleur principale | orange `#F26900` | **vert** `#2D5016` | l'app passe à l'orange ? |
| Texte | `#121212` / `#5b5b5b` | `#1A1612` / `#6B6158` | l'app passe aux valeurs du site ? |
| Fond | beige `#FFF4E6` (corps blanc) | crème `#F7F3EE` | idem |
| Police | Inter | police du système | charger Inter dans l'app ? |
| Erreur, succès, bordures, espacements | — | définis dans l'app seulement | les reprendre dans `tokens.json` tels quels ? |
