# Traductions de Tiroir

**Seule source : ce dossier.** Comme les couleurs (`design/tokens.json`), un
texte de l'app ou du site se décide ici, et nulle part ailleurs. Une même
langue, un même dossier, pour l'app, le site et les e-mails : quand un utilisateur change
de langue, tout Tiroir suit (sa langue est aussi gardée dans son compte,
`user_metadata.locale`, lue par le site et les e-mails).

## Modifier ou ajouter un texte

1. Changer le texte dans `app/`, `site/` ou `email/<langue>.json`
   (référence : le français ; les autres langues suivent ses clés).
2. `node design/generate.mjs` — réécrit les fichiers générés.
3. `node scripts/i18n-check.mjs` — signale les clés manquantes par langue.
4. Commiter le tout. `web/__tests__/designTokens.test.ts` casse si un
   fichier généré a été modifié à la main ; `i18nCentral.test.ts` casse si
   une langue est trouée.

## Ajouter une langue

1. Une ligne dans `languages.json` : code (BCP 47 : `it`, `pt-BR`…), nom écrit
   dans la langue, balise Intl, `app` et `site`. Une langue partielle déclare
   sa langue mère (`"fallback": "pt-BR"`) et ne contient que les clés qui
   diffèrent.
2. Les fichiers `app/`, `site/`, `system/` de la langue (le script dit ce
   qui manque).
   Sur le site, une langue peut être servie sous un autre préfixe
   (`"siteCode": "pt"` pour pt-BR) et rester partielle
   (`"siteFallback": "en"`) : son `site/<langue>.json` ne contient alors que
   des sections de premier niveau entières (pt-BR : `layout`, `home`,
   `errors`), le reste vient de la langue de repli.
3. `node design/generate.mjs` : l'app (ressources, sélecteur, Réglages ›
   Tiroir › Langue, demandes d'accès iOS) et le site suivent seuls.
4. À la main, pour l'instant : la liste `locales` de `web/next.config.js` et
   `LOCALES` de `web/lib/localeRouting.ts` (le test vérifie qu'elles
   correspondent à `languages.json`), et le prompt des Edge Functions d'IA.

## Ce qu'il y a ici

| Fichier | Contenu | Devient |
| --- | --- | --- |
| `languages.json` | la liste des langues, langue de référence, langue par défaut, repli, variantes par pays | `mobile/src/i18n/languages.generated.ts`, `web/locales/languages.generated.ts`, `supabase/functions/_shared/languages.generated.ts`, langues natives de `mobile/app.json` |
| `app/<langue>.json` | textes de l'app (i18next, `{{variable}}`, pluriels `_one` / `_other`) | `mobile/src/i18n/locales/<langue>.json`, `mobile/src/i18n/resources.generated.ts` |
| `site/<langue>.json` | textes du site (`{variable}`) ; `share`, `account`, `about`, `legal` deviennent des fichiers à part | `web/locales/<langue>.ts` et `web/locales/<section>/<langue>.ts` (types `Copy`, `ShareCopy`…) |
| `system/<langue>.json` | textes système de l'app (demandes d'accès caméra et photothèque) | `mobile/locales/<langue>.json`, déclarés dans `mobile/app.json` |
| `email/<langue>.json` | e-mails : `share` (partage) et `presentation` (J+3, HTML + version texte) ; une langue partielle hérite de sa langue mère | `supabase/functions/_shared/emailCopy.generated.ts`, `_shared/emailPresentation.ts` (avec le gabarit `marketing/emails/gabarits/presentation.html`), aperçu `marketing/emails/presentation.html` |

Les clés qui commencent par `$` sont des notes pour les humains :
`$comment` décrit l'objet, `$clé` décrit la clé qui la suit. Elles
deviennent des commentaires dans le TypeScript du site et disparaissent
des fichiers de l'app.

## Pas encore ici

- L'e-mail de présentation dans d'autres langues que le français : la
  mise en page est prête, il manque les textes (et `profiles.locale` en
  base pour choisir la langue de chaque compte).
- Les e-mails d'authentification (confirmation, mot de passe oublié) : ils
  sont réglés dans le tableau de bord Supabase, pas dans ce dépôt.
- Les quatre gabarits marketing collés à la main (`marketing/emails/`).
- Le prompt des Edge Functions d'IA (`chat-turn`, `describe-object`) : la
  liste générée `_shared/languages.generated.ts` est prête, pas encore lue
  (à faire avec un redéploiement des fonctions).
- Les textes des fiches store et du marketing : `V4_PLAN.md`, annexes A et B,
  le temps qu'ils soient validés.
