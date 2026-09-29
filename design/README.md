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
| App iOS et Android (une seule app Expo) | `mobile/src/components/ui/brandTokens.generated.ts` | ✅ fil 2 — lu par `mobile/src/components/ui/tokens.ts` |
| E-mails | `supabase/functions/_shared/brandTokens.generated.ts` | ⏳ fil 3 |

## La suite, fil par fil

1. ✅ **Source unique + générateur**, site branché (valeurs identiques :
   rien ne change à l'écran).
2. ✅ **App** : `tokens.ts` lit `Brand` ; l'app passe aux valeurs du site
   (orange, textes, fonds). Visible à la prochaine version de l'app.
3. **E-mails** : `emailPresentation.ts` lit `Brand`.
4. **Couleurs en dur** : remplacer, écran par écran, les centaines de
   valeurs recopiées à la main (`#F26900`, `#1A1612`…) sur le site et
   dans l'app.

## Fil 2 : ce qui a changé dans l'app (décision du 29/09 : tout suit le site)

| Jeton de l'app | Avant | Après |
| --- | --- | --- |
| `accent` (boutons, liens, sélection) | vert `#2D5016` | orange `#F26900` |
| `accentLight` | vert sauge `#E8F0E0` | beige `#FFF4E6` |
| `background` | crème `#F7F3EE` | beige clair `#FFF8EF` |
| `surfaceWarm` | `#F0EBE3` | beige `#FFF4E6` |
| `textPrimary` | `#1A1612` | `#121212` |
| `textSecondary` | `#6B6158` | `#5b5b5b` |

Le reste (surfaces, texte tertiaire, erreur, succès, bordures, espacements,
tailles de texte) n'existait que dans l'app : repris tel quel dans
`tokens.json` (« origine: app »). La police reste celle du système dans
l'app : charger Inter demandera d'ajouter la police au paquet de l'app.

**À surveiller** : du texte blanc sur l'orange `#F26900` a un contraste
d'environ 3:1, sous le seuil recommandé (4,5:1) pour du texte courant. Le
site vit déjà avec ; à vérifier sur les petits libellés de l'app.
