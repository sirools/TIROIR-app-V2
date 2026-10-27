# Tiroir V4.0 — plan d'implémentation holistique

27 octobre 2026 · préparé pour Clément Ougier · branche `claude/v4-holistique`
(partie de `main` au commit `1865642`, rien n'est fusionné, rien n'est déployé).

> **Vision qui tranche chaque arbitrage** : Tiroir est une seule expérience,
> web et mobile, utile à tous, propulsée par Torix. Un répertoire
> d'inventaires imparfaits, qu'on montre aux autres en toute sécurité, pour
> garder, prêter, revendre, transmettre plutôt que racheter.
>
> Trois règles : **ISO web / mobile** · **une seule source de vérité** ·
> **sécurité par défaut**.

## Sommaire

0. [Ce qui est fait dans cette session](#0-ce-qui-est-fait-dans-cette-session)
1. [Audit du dépôt](#1-audit-du-dépôt)
2. [Plan par chantier, ordonné par dépendances](#2-plan-par-chantier-ordonné-par-dépendances)
3. [Chantier 1 — Langues et régions](#3-chantier-1--langues-et-régions)
4. [Chantier 2 — App V4.0 : écarts écran par écran](#4-chantier-2--app-v40--écarts-écran-par-écran)
5. [Chantier 3 — Offres et stores](#5-chantier-3--offres-et-stores)
6. [Chantier 4 — Web](#6-chantier-4--web)
7. [Chantier 5 — Marketing et marque Torix](#7-chantier-5--marketing-et-marque-torix)
8. [Checklist ISO web / mobile](#8-checklist-iso-web--mobile)
9. [Décisions qui attendent Clément](#9-décisions-qui-attendent-clément)
10. [Annexe A — Textes des fiches store (6 langues)](#annexe-a--textes-des-fiches-store-6-langues)
11. [Annexe B — Textes marketing et in-app (6 langues)](#annexe-b--textes-marketing-et-in-app-6-langues)

---

## 0. Ce qui est fait dans cette session

Tout est sur la branche, rien en prod, aucune migration, aucun produit de
store, de RevenueCat ou de Stripe touché, aucun secret ajouté.

| Livrable | Fichiers | Vérifié par |
| --- | --- | --- |
| Portugais du Brésil, traduction complète (802 clés) | `mobile/src/i18n/locales/pt-BR.json` | `node scripts/i18n-check.mjs` : 802/802 |
| Portugais du Portugal, **207 clés divergentes seulement**, repli sur pt-BR puis anglais | `mobile/src/i18n/locales/pt-PT.json`, `mobile/src/i18n/index.ts` (`FALLBACKS`) | le script charge i18next 25.10.10 (la version de l'app) et vérifie le repli clé simple + pluriel |
| Détection pt-BR / pt-PT selon le pays de l'appareil (PT, AO, MZ, CV… → pt-PT ; sinon pt-BR) | `mobile/src/i18n/index.ts` (`resolveLanguage`, `deviceLanguage`) | `tsc --noEmit` |
| Mode « Automatique » (suivre l'appareil) | `getLanguagePreference`, `setAppLanguage('auto')` | `tsc --noEmit` |
| Section **Préférences** en tête de Paramètres : ligne « Langue › » et « Région › », chacune ouvre une sheet (« Automatique » d'abord, puis chaque langue écrite dans sa langue) | `mobile/app/(app)/settings.tsx` (réutilise `ActionSheet`) | `tsc --noEmit` ; à voir sur appareil |
| Région d'estimation séparée de la langue (défaut « Automatique », repli France = comportement actuel) | `mobile/src/i18n/region.ts` | `tsc --noEmit` ; **pas encore lue par le serveur** |
| Langues natives déclarées (Réglages › Tiroir › Langue sur iOS, langue par app sur Android 13+) | `mobile/app.json` : option `supportedLocales` du plugin `expo-localization` | `expo config --type introspect` et `expo prebuild` (dossiers générés puis supprimés) : 6 `*.lproj`, `locales_config.xml` |
| Demandes d'accès caméra et photothèque traduites (6 langues) | `mobile/locales/*.json`, clé `locales` de `app.json` | `InfoPlist.strings` générés dans les 6 `*.lproj` |
| Fiches IA et e-mail de partage : le portugais est compris côté serveur | `supabase/functions/chat-turn/*`, `describe-object/index.ts`, `_shared/shareEmailCopy.ts` (pt → anglais tant que le site n'a pas de portugais) | additif ; **à redéployer avant la sortie de l'app** |
| L'app envoie `pt-BR` / `pt-PT` à l'IA (avant : retombait sur l'anglais) | `mobile/src/services/assistant/SupabaseAssistantService.ts` | `tsc --noEmit` |
| Marque Torix : un composant unique `TorixMark` (✦ + libellé) ; « Estimation Torix », « Résumé Torix », « Torix analyse ta photo… » dans les 6 langues | `mobile/src/components/ui/TorixMark.tsx`, 15 clés renommées par langue, espace `torix.*` | `tsc --noEmit` |
| Brouillon de la **config unique des paliers** | `config/tiers.json` | `web/__tests__/tiersConfig.test.ts` (6 tests) : prix = `OFFERS_V4`, packs, produits de la checklist stores, colonnes `app_settings`, coût des crédits |
| Script de clés manquantes par langue (+ variables `{{…}}`, langues partielles, ISO langues app/site, langues natives) | `scripts/i18n-check.mjs` | sortie 0 |

**Deuxième passage (27/10, après-midi)**

| Livrable | Fichiers | Vérifié par |
| --- | --- | --- |
| Fusion de `feat/stores-grille-v4`, `claude/mobile-credits-cta`, `feat/langue-compte` dans cette branche | conflits des fichiers de langue et de Paramètres résolus ; clés ajoutées par ces branches traduites en pt-BR / pt-PT | `i18n-check`, `tsc`, tests du site |
| La langue suit le compte : choisir une langue (ou « Automatique », résolue) l'inscrit dans `user_metadata.locale`, lu par le site et les e-mails | `mobile/app/(app)/settings.tsx`, `mobile/src/features/auth/accountLocale.ts` | `tsc` |
| Brouillon `profiles.locale` : accepte `pt-BR` et `pt-PT` (« pt_PT » → pt-PT, « pt » → pt-BR) | `supabase/drafts/profiles_locale.sql` | 14 tests sur une base Postgres jetable (`run_locale.sh`) |
| **Traductions centralisées dans le design system** : `design/i18n/` (langues, app, site, textes système), générées par `node design/generate.mjs` comme les couleurs | `design/i18n/`, `design/i18n.mjs` ; fichiers générés dans `mobile/` et `web/` | les 25 fichiers du site régénérés donnent **exactement les mêmes textes** (valeurs comparées) ; fichiers de l'app identiques à l'octet ; `generate.mjs --check` ; `web/__tests__/i18nCentral.test.ts` |

**Troisième passage — les e-mails sur `design/i18n/`** : e-mail de partage
et e-mail de présentation (J+3) lisent leurs textes dans
`design/i18n/email/` ; la présentation a un gabarit HTML sans texte
(`marketing/emails/gabarits/presentation.html`) et le générateur remplace
`scripts/build-email-template.py`. Vérifié : HTML envoyé, aperçu, objet,
première phrase, version texte et e-mail de partage dans les 5 langues
existantes **identiques à l'octet** ; seul changement voulu, un expéditeur
en portugais envoie désormais l'e-mail de partage en portugais (le lien
ouvre le site en anglais). `deno check` passe sur `create-share-link`,
`send-lifecycle-emails` et `describe-object`. L'erreur de type de
`chat-turn`, **présente sur `main` depuis le 30/09** (code de refus de
`refusal()` typé `string`), est corrigée : `deno check` passe sur
`chat-turn` et les cinq autres fonctions qui utilisent `refusal()`.
À redéployer : `create-share-link`, `send-lifecycle-emails`, `chat-turn`.

Tests lancés au premier passage : `web` → 302 tests sur 303 passent ; le seul échec est
`build.test.ts`, qui exige `NEXT_PUBLIC_SUPABASE_URL` et la clé anonyme,
absentes de ce conteneur (même erreur sans mes changements). `mobile` →
`tsc --noEmit` sans erreur.

À faire par Clément pour voir le résultat : un build de développement
(`eas build --profile development`) ou TestFlight, puis Paramètres ›
Préférences, et Réglages iOS › Tiroir › Langue.

---

## 1. Audit du dépôt

### 1.1 Structure

| Dossier | Rôle | Remarques |
| --- | --- | --- |
| `mobile/` | App Expo SDK 56, React Native 0.85, expo-router | version déjà **4.0.0** dans `app.json` ; bundle iOS `com.sirools.tiroir`, Android `com.tiroir.app` |
| `web/` | Next.js 14, Pages Router, Vercel | vitrine `tiroir.app`, back-office `backoffice.tiroir.app`, partages `/s/<jeton>` |
| `supabase/` | migrations (prod) et Edge Functions | 13 fonctions ; `drafts/` = SQL non appliqué |
| `v4/` | chantier V4 isolé (trousseau, prêt, suggestions, vente) | **ni `web/` ni `mobile/` ne l'importent** (règle du `v4/README.md`) |
| `design/` | `tokens.json`, seule source des couleurs et polices | générateur `design/generate.mjs` |
| `strategie/` | offres, packs stores, Torix | grille V4 **figée le 19/10/2026** (`strategie/offres.md`) |
| `preprod/` | stack de pré-prod sur le NAS | runbook Supabase preprod |
| `config/` | *(nouveau)* `tiers.json` | brouillon |
| `design/i18n/` | *(nouveau)* seule source des traductions | voir `design/i18n/README.md` |

### 1.2 État de la « branche V4 »

**Il n'existe pas de branche nommée V4.** Ce que le code confirme :

- `main` porte déjà la V4 côté app (`"version": "4.0.0"`) et le bloc valeur V4
  (branches `claude/v4-*` fusionnées).
- `claude/mobile-version-4.0.0` (26/09) est une branche **divergente et
  périmée** : 163 commits absents de `main`, 133 de retard, issus d'une
  ancienne histoire. Ne pas la reprendre.
- J'ai donc créé `claude/v4-holistique` depuis `main` (option la plus
  réversible : une branche se supprime). **À confirmer** (décision D1).

Branches qui touchent directement la V4 (les trois premières sont
**fusionnées dans cette branche** depuis le second passage) :

| Branche | Contenu | Conflit avec cette branche |
| --- | --- | --- |
| `feat/stores-grille-v4` (4 commits, 17 de retard) | packs 50/150/500, palier Pro des stores dans le webhook (`_shared/storeProducts.ts`), Pro dans l'écran d'abonnement | non (fichiers différents) ; **prérequis du chantier 3** |
| `claude/tiroir-credits-billing-9k30og` (5) | crédits Stripe sur le site, Business par siège, **décision du 26/10 : crédits par achat intégré dans l'app ET Stripe sur le site, sans lien de l'app vers le site** | non |
| `claude/mobile-credits-cta` (1) | « Acheter des crédits » sur chaque refus `QUOTA_EXCEEDED` | oui, sur les 4 JSON de langues (clés ajoutées) : à rejouer en pt-BR / pt-PT |
| `feat/langue-compte` (2) | langue du compte posée à l'inscription, brouillon `profiles.locale` | oui, `mobile/src/i18n/index.ts` et `settings.tsx` : fusion manuelle simple |
| `fix/pricing-pro-disponible` (4, 10 de retard) | page Tarifs : Premium et crédits s'achètent dans l'app | non |
| `feat/homepage-v2` (1, 31 de retard) | prototype de homepage mobile d'abord sur `/v2` | non ; base du chantier 4 |

### 1.3 i18n

| | App | Site | Edge Functions |
| --- | --- | --- | --- |
| Bibliothèque | **i18next 25 + react-i18next 16 + expo-localization** | i18n natif de Next (routes `/en`, `/da`…) + objets TypeScript typés `Copy` | tables par fonction |
| Langues | fr, en, es, de → **+ pt-BR, pt-PT** | fr, en, **da**, de, es | IA : fr, en, es, de (→ + pt) ; e-mail de partage : fr, en, da, de, es |
| Référence | 802 clés, JSON imbriqué, pluriels `_one` / `_other` | `fr.ts` (type `Copy`, le compilateur force la complétude) | — |
| Détection | langue de l'appareil, puis choix enregistré | **désactivée** (`localeDetection: false`) ; da/de/es : seule la homepage est traduite, le reste renvoie vers l'anglais | langue envoyée par l'app |

Écarts ISO relevés : **le danois existe sur le site, pas dans l'app** ; le
portugais existe maintenant dans l'app, pas sur le site ; les textes
système iOS n'étaient qu'en français.

### 1.4 Paliers — aujourd'hui, au moins neuf endroits disent les prix ou les quotas

| Où | Ce qu'il dit |
| --- | --- |
| `web/lib/offers.ts` `OFFERS` | ancienne grille du 30/09 (Premium 49,99 €, packs 30/80, Pro 1 700 € HT) — encore vendue par l'app |
| `web/lib/offers.ts` `OFFERS_V4` | grille du 19/10 : Free 20 actions, packs 50/150/500, Premium 4,99 €/mois ou 39 €/an, Pro 14,99 €, Business 39 €/siège |
| `web/lib/planQuotas.ts` `FALLBACK` | quotas de repli (Free 10 analyses, Premium 60, Pro 300) — **différents** de `strategie/offres.md` |
| `app_settings` (base, back-office › Quotas) | quotas appliqués ; défauts de migration Free 30, Premium 150, Pro 300 |
| `mobile/src/lib/plan.ts` | `free` / `premium` / `pro` ; Pro décrit comme « vendu sur facture » |
| `mobile/src/lib/creditPacks.ts` + webhook RevenueCat | packs 30 / 80 |
| `mobile/app/(app)/paywall.tsx` | prix factices de démonstration 6,99 € / 59,99 € ; « € / mois » écrit en dur |
| webhook RevenueCat | **tout abonnement des stores donne `premium`** ; aucun entitlement nommé dans le code (l'app lit `entitlements.active` sans filtre) |
| `strategie/offres.md`, `packs-stores.md`, fiches de Torix | la grille du 19/10 |

→ Le chantier 3 remplace tout cela par `config/tiers.json` (brouillon fait).

### 1.5 Partage

| Exigence « sécurité par défaut » | Code actuel | Écart |
| --- | --- | --- |
| Lecture seule par défaut | oui : le partage n'expose aucune écriture ; suggestions **désactivées par défaut** (`collections.suggestions_enabled DEFAULT false`) | — |
| Ne montrer que le nécessaire | **non** : `options.fields` vaut `true` pour tout (montants, **emplacement**, **assurance**, description) à la création, côté app comme côté fonction | **à corriger** : emplacement et assurance décochés par défaut |
| Mot de passe défini par le propriétaire | oui, à la création (4 caractères minimum) | — |
| … changé et révoqué | **non** : « Pour poser un nouveau mot de passe, il faut créer un nouveau lien » ; révocation = supprimer le lien | **à faire** |
| Stockage du mot de passe | SHA-256 **sans sel**, comparaison non constante, **aucune limite d'essais** sur `/api/shares/[token]/verify` | **à durcir** (hachage salé lent, limite d'essais) |
| Expiration | « Sans expiration » possible ; aucune par défaut | à décider (D10) |
| Suggestions identifiées sur le web, « + » → création de compte | oui (`pages/s/[token].tsx`, étape `signup`) | vérifier prénom + nom d'utilisateur + photo |

### 1.6 Torix dans le produit

- **Aucune mention de Torix dans l'app** avant cette branche ; « IA » partout
  (31 chaînes en français).
- Le site suit la règle « on vend un résultat, pas de l'IA : l'IA n'apparaît
  jamais dans un titre » (`web/locales/fr.ts`).
- `strategie/torix-et-tiroir.md` : Torix appartient **au fondateur**, pas à la
  société ; un **contrat de licence Torix → Tiroir** est à organiser avant
  d'associer quelqu'un. Montrer Torix comme la marque publique de l'IA de
  Tiroir rend ce contrat plus urgent (D7).
- `web/components/torix/ownership.ts` contient « Torix est breveté et
  protégé par une licence ». **Aucune trace de brevet dans le dépôt** : ne
  jamais reprendre cette phrase dans un texte public (garde-fou
  « pas d'allégation sans preuve »).

### 1.7 Estimation de valeur

- `estimate-value` : prompt **France seulement** (leboncoin, Vinted, eBay
  France), devise renvoyée « € » (symbole), alors que d'autres écrans
  attendent un code ISO (`EUR`) — deux formats en base.
- Même parcours pour tous les paliers : bouton « Estimer » manuel, débit de
  crédits ou de quota. **Pas d'historique de valeur, donc pas de courbe.**
- Pas d'export assurance ni d'estimation en lot dans l'app (le site a un
  export PDF des partages).

### 1.8 Divers trouvés en chemin

- `web/package-lock.json` désynchronisé de `package.json` : `npm ci` échoue
  (le build Vercel utilise probablement `npm install`). À régénérer dans une
  PR à part.
- Paramètres › Supprimer mon compte : le texte demande de taper
  « SUPPRIMER », mais aucun champ n'existe.
- `paywall.legal` mentionne « les Réglages iOS » aussi sur Android.

---

## 2. Plan par chantier, ordonné par dépendances

Effort en jours de travail (une personne + Claude), hors revue Apple / Google.

```
D (décisions)  ─┬─► C3.1 config paliers ─► C3.2 app + webhook ─► C3.3 stores (Clément) ─► C4.2 page Tarifs
                │                    └──► C2.2 estimation par palier
                ├─► C1 (langues, fait à 70 %) ─► C1.4 région côté serveur ─► C2.2
                │                           └─► C4.4 site en 6 langues
                ├─► C2.3 partage sûr (indépendant, à faire tôt)
                └─► C5 plateforme de message ─► textes store, homepage, onboarding
Chaque version : C4.5 checklist ISO
```

| # | Étape | Dépend de | Effort | Risque |
| --- | --- | --- | --- | --- |
| **0** | Décisions D1 à D12 (§ 9) | — | ½ j de Clément | — |
| **0b** | Fusionner ou fermer les branches du § 1.2 | 0 | ½ j | conflits i18n simples |
| **C1.1** | pt-BR, pt-PT, repli, détection, Préférences, langues natives, textes système | — | ✅ fait | — |
| C1.2 | Relecture native pt-BR et pt-PT (et da/de/es, déjà demandée dans `shareEmailCopy.ts`) | C1.1 | 1 j (externe) | faible |
| C1.3 | Redéployer `chat-turn`, `describe-object`, fonctions qui lisent `shareEmailCopy` | C1.1 | ¼ j | faible, additif |
| C1.4 | Région côté serveur : `estimate-value` reçoit `region`, choisit marchés et devise ; devise stockée en code ISO | D9 | 2 j | moyen (prompt, coût) |
| C1.5 | Danois dans l'app, ou retiré du site (ISO) | D4 | 1 j | faible |
| **C3.1** | `config/tiers.json` validé, puis lu par le site (`offers.ts` dérivé) et l'app (copie générée, comme `design/generate.mjs`) | D2, D3 | 2 j | faible |
| C3.2 | App + webhook : fusion de `feat/stores-grille-v4`, entitlement nommé, Pro dans le paywall, prix lus des stores (jamais en dur) | C3.1 | 2 j | moyen (achats) |
| C3.3 | Stores, RevenueCat, Stripe : créer / renommer selon § 5.2 | C3.2 | 1 h + revue (Clément) | **réel, hors code** |
| C3.4 | Migration des Premium existants (§ 5.4) | C3.2 | 1 j | moyen |
| **C2.1** | Fiche objet : ordre carrousel → cartes → bloc Estimation Torix (IA → ajustements → prix définitif) | Figma | 2 j | faible |
| C2.2 | Estimation par palier : Free crédits ; Premium auto + compteur + « Actualiser » + courbe + sources en une ligne ; Pro détail, export assurance, lot | C3.1, C1.4, migration `value_history` | 5 j | moyen (migration additive en preprod d'abord) |
| C2.3 | Partage sûr : champs sensibles décochés par défaut ; mot de passe changeable et révocable ; hachage salé + limite d'essais | — | 2 j | moyen (migration de hachage douce) |
| C2.4 | Idées d'objets via API marchandes (neuf puis seconde main) | D11, `collection_wishes` (prod) | 4 j | moyen (contrats d'API, affiliation) |
| C2.5 | Torix : finir le renommage (écrans restants, assistant), `TorixMark` partout | D7 | 1 j | faible |
| **C4.1** | Homepage V2 mobile d'abord (base `feat/homepage-v2`) | C5.1 | 4 j | faible |
| C4.2 | Page Tarifs lue depuis `config/tiers.json`, « annuel = 1 mois offert » si D3 le confirme | C3.1, D3 | 1 j | faible |
| C4.3 | Partage web : mot de passe, suggestions identifiées, « + » → compte | C2.3 | 1 j | faible |
| C4.4 | Site en 6 langues + détection auto + sélecteur du pied de page | C1.2, D4 | 5 j (pages juridiques à faire relire) | moyen (juridique) |
| C4.5 | Checklist ISO automatisée en CI (§ 8) | C3.1, C1 | 1 j | faible |
| **C5.1** | Plateforme de message validée | D7, D8 | ½ j de Clément | — |
| C5.2 | Textes store, onboarding, in-app intégrés (annexes A et B) | C5.1, C3.1 | 1 j | faible |

Total code ≈ 37 jours, dont ≈ 10 jours bloqués par des décisions.

---

## 3. Chantier 1 — Langues et régions

### 3.1 Clés existantes

809 clés dans `design/i18n/app/fr.json` (référence de l’app ; 802 au premier passage, +7 venues des branches fusionnées), 652 dans `design/i18n/site/fr.json`. Liste complète,
clé et texte : `node scripts/i18n-check.mjs --list`.

| Espace | Clés | Espace | Clés | Espace | Clés |
| --- | --- | --- | --- | --- | --- |
| object | 195 | sharePanel | 38 | paywall | 37 |
| auth | 57 | profile | 37 | scene | 37 |
| collectionDetail | 43 | batch | 36 | capture | 33 |
| settings | 28 | assistant | 28 | uploading | 25 |
| shares | 21 | documents | 20 | collections, groups | 17 |
| home, objectEdit | 14 | shareView | 13 | common, search | 12 |
| collectionComposer | 11 | preferences *(nouveau)* | 10 | onboarding, menu | 7 |
| status, collectionSort | 6 | collectionPicker, emojiKeyboard | 5 | iconPicker | 4 |
| torix *(nouveau)* | 3 | language, documentViewer | 2 | | |

### 3.2 pt-BR et pt-PT

- **pt-BR** : traduction complète, registre « você », phrases directes, comme
  le tutoiement du français. Torix est masculin (« o Torix »), comme dans
  `web/components/torix/` (« l'aiguilleur », « l'ami de ton papa »).
- **pt-PT** : 207 clés seulement, le reste vient de pt-BR. Les divergences
  suivent quelques familles, ce qui rend la liste courte à relire :

| Brésil | Portugal | Clés touchées |
| --- | --- | --- |
| senha | palavra-passe | authentification, paramètres, partage |
| compartilhar / link | partilhar / ligação | partages |
| excluir / salvar | eliminar / guardar | actions |
| entrar / sair | iniciar / terminar sessão | connexion |
| configurações / ajustes | definições | paramètres, permissions |
| câmera / galeria / foto | câmara / fototeca / fotografia | capture, documents |
| assinatura / assinar | subscrição / subscrever | abonnements |
| gerúndio (« Enviando… ») | « A enviar… » | états de chargement |
| guillemets “…” | guillemets «…» | titres de confirmation |
| arquivo, baixar, celular, nota fiscal | ficheiro, transferir, telemóvel, fatura | fichiers, partage |

Le **repli a été vérifié dans i18next 25.10.10** (même version que l'app) :
une clé absente de pt-PT sort en pt-BR, une clé propre sort en pt-PT, un
pluriel hérité fonctionne. Le script le revérifie à chaque passage
(`NODE_PATH` vers un i18next, ou après `npm install` dans `mobile/`).
Point technique : `load: 'currentOnly'` évite qu'i18next cherche un « pt »
générique, et `fallbackLng` déclare `{ 'pt-PT': ['pt-BR', 'en'] }`.

### 3.3 Script de clés manquantes

```bash
node scripts/i18n-check.mjs          # rapport ; sortie 1 si une langue complète est trouée
node scripts/i18n-check.mjs --list app    # toutes les clés de référence de l'app
node scripts/i18n-check.mjs --list site   # du site
```

Il signale : clés manquantes par langue, clés inconnues, variables `{{…}}`
différentes de la référence, copies inutiles dans pt-PT, repli i18next, langues
de l'app absentes du site (et inversement), langues natives iOS déclarées.
À brancher en CI avec la checklist ISO (C4.5).

### 3.4 Sélecteur de langue : maison ou réglages du système ?

Les deux sont maintenant possibles : la sheet maison existe, et les langues
sont déclarées au système (`supportedLocales`), donc **Réglages › Tiroir ›
Langue** apparaît sur iOS, et la langue par app sur Android 13+.

| | A. Sheet maison seule | B. Renvoi vers les réglages système seul | **C. Les deux (recommandé)** |
| --- | --- | --- | --- |
| Change sans quitter l'app | oui, instantané | non : iOS relance l'app | oui |
| Android 12 et moins | oui | **non** (pas de langue par app) | oui |
| Cohérent avec le reste du téléphone | non, deux réglages possibles | oui, un seul réglage | oui si « Automatique » = suivre le système |
| Découvrable | oui | faible | oui |
| Effort | fait | lien `Linking.openSettings()` | fait + 1 ligne |
| Risque | un choix maison masque le réglage système | utilisateurs Android 12 bloqués | à expliquer en une ligne |

**Recommandation : C.** « Automatique » (défaut) suit la langue choisie dans
le système, y compris la langue par app ; choisir une langue dans la sheet
l'emporte jusqu'à ce qu'on revienne à « Automatique ». Ajouter plus tard une
ligne « Ouvrir les réglages de l'appareil » (clé `preferences.systemSettings`
déjà traduite). Décision D5.

### 3.5 Région / devise

- Fait : `mobile/src/i18n/region.ts` — préférence séparée (`app-region`),
  « Automatique » = pays de l'appareil s'il fait partie des 12 marchés
  listés (FR, BE, LU, CH, DE, AT, ES, PT, BR, GB, US, CA), sinon **France,
  le comportement actuel**. Libellé « Brésil · BRL » dans la langue de
  l'app (`Intl.DisplayNames`, code seul si le moteur ne l'a pas).
- À faire (C1.4) : l'app envoie `region` à `estimate-value` ; le prompt
  choisit les places de marché (Brésil : Mercado Livre, OLX, Enjoei ;
  Portugal : OLX, Custo Justo, Vinted ; Allemagne : Kleinanzeigen, eBay.de ;
  etc.) et la devise ; la base stocke **toujours un code ISO** (`BRL`, pas
  « R$ ») — corriger au passage le « € » écrit par la fonction. Les montants
  s'affichent avec `Intl.NumberFormat(langue, { currency })`.
- À décider (D9) : liste des marchés au lancement, et conversion ou non des
  anciennes valeurs (proposition : jamais de conversion automatique, la
  devise reste celle de l'estimation).

### 3.6 Web : mêmes langues, mêmes clés — source unique en place

**Fait au second passage** : `design/i18n/` porte les textes de l'app et du
site, la liste des langues et les textes système ; `node design/generate.mjs`
écrit `mobile/src/i18n/locales/*.json`, `web/locales/**/*.ts` et les listes
de langues. Ajouter le portugais au site = écrire `design/i18n/site/pt-BR.json`
(le script liste les 652 clés), passer `"site": true` dans `languages.json`,
ajouter la langue à `next.config.js` et `localeRouting.ts` (un test vérifie
qu'elles concordent). Le paragraphe ci-dessous est l'étape suivante.

Constat de départ, gardé pour l'historique :

État : site en fr, en, da, de, es ; seule la homepage est traduite en
da/de/es ; détection désactivée.

Proposition d'**un fichier de traductions partagé** : les deux structures
sont trop différentes pour fusionner tout de suite (802 clés d'écrans
d'app contre des pages web). On partage ce qui doit être identique :

```
i18n/shared/<langue>.json     # paliers, prix, crédits, Torix, statuts, partage
  ├─ lu tel quel par l'app (espace « shared »)
  └─ importé par web/locales/*.ts (typé par le même schéma)
```

Premier lot : noms des paliers, phrases de quota et de crédits, statuts
d'objet, textes du partage et de la confidentialité, présentation de Torix.
Un test compare les deux côtés (comme `torixKnowledge.test.ts`).

---

## 4. Chantier 2 — App V4.0 : écarts écran par écran

Maquettes : Figma `r1Z1rSRohAE6lTxDB2DCQw`, page « Tiroir V4 - Estimation »
— **non consultées dans cette session** : les écarts ci-dessous viennent du
brief et du code ; à recroiser avec les maquettes avant C2.1.

| Écran | Spec V4 | Code actuel | Écart | Sûr maintenant ? |
| --- | --- | --- | --- | --- |
| Fiche objet — ordre | carrousel → petites cartes → bloc Estimation Torix | carrousel (`pagingEnabled`) → titre → grille d'infos → **Résumé IA** → statut / collection → prêt → quantité / emplacement → caractéristiques → **Valeur** → documents → assurances | bloc valeur trop bas, résumé intercalé | non (dépend des maquettes) |
| Bloc Estimation | estimation IA d'abord, ajustements ensuite, prix définitif en dernier | valeur marché, achat, revente, caution, remise de lot mélangés dans `ValeurCard` | réordonner en 3 étages | après maquettes |
| Libellés Torix | « Estimation Torix », « Torix analyse ta photo… » | « IA » | ✅ **fait** pour 15 clés × 6 langues + `TorixMark` sur le bloc valeur et le résumé | fait |
| Free | crédits, 20 actions IA / mois, puis rachat proposé | quotas mensuels + crédits (débit `ai_credits_spend`) ; achat de crédits sur refus seulement dans la branche `claude/mobile-credits-cta` | fusionner la branche ; quota Free à régler à 20 dans le back-office (`https://backoffice.tiroir.app`, onglet Quotas) | oui, après fusion |
| Premium | estimation automatique, compteur de quota, « Actualiser », courbe de valeur, sources en une ligne | estimation **manuelle** ; « ↻ Rafraîchir » existe ; sources dans un tiroir d'info ; **pas d'historique** | estimation à la création (coût : 8 crédits par objet → à plafonner), compteur, table `value_history` (migration additive, preprod d'abord), courbe | non : migration |
| Pro | + détail des sources, export assurance, estimation en lot | rien de spécifique (Pro = Premium + quotas) | 3 fonctions nouvelles ; l'export peut réutiliser `web/lib/shareExportData.ts` | non |
| Collection — idées d'objets | ajouter un objet à acheter via API marchandes, neuf puis seconde main | `collection_wishes` en prod (statut `idea`, `url`, `price`, `currency`) ; ajout manuel | brancher une recherche marchande (D11) | non |
| Partage — lecture seule | par défaut | oui | — | — |
| Partage — champs | (sécurité par défaut) | tout visible, emplacement et assurance compris | décocher emplacement et assurance par défaut | **oui, petit** — laissé pour une PR à part car il change le comportement des partages existants côté app (D10) |
| Partage — suggestions par collection | activables | oui, désactivées par défaut | — | — |
| Partage — mot de passe | défini, changé, révoqué par le propriétaire | défini à la création seulement | RPC `set_share_password` / `clear_share_password`, écran Réglages du partage ; hachage salé | non : migration + fonction |
| Paramètres | Préférences (Langue + Région) avant Compte | liste de langues en ligne | ✅ **fait** | fait |
| Paywall | Free / Premium / Pro identiques au web | Premium seul (Pro dans `feat/stores-grille-v4`), prix factices 6,99 / 59,99 en mode démo, « € / mois » en dur | lire prix et devise du store ; Pro | après C3.1 |
| Paramètres › suppression | — | demande de taper « SUPPRIMER » sans champ | ajouter le champ ou retirer la phrase | oui, petit |

### Règle de nommage Torix (appliquée dans cette branche)

- **Torix est celui qui agit** : « Torix analyse ta photo… », « Estimer avec
  Torix », « Résumé Torix », « Estimation Torix ».
- **« IA » reste l'unité de compte** : « crédits IA », « 20 actions IA par
  mois », « quota IA épuisé ». Raison : ce sont des mots de facturation, lus
  par les stores et par le droit de la consommation ; « 20 Torix par mois »
  ne voudrait rien dire.
- Un seul composant, `TorixMark` (✦ orange + libellé). Masculin : « Torix
  lui-même », « o Torix », « der … » évité (« Torix analysiert »).

---

## 5. Chantier 3 — Offres et stores

### 5.1 Config unique des paliers (brouillon)

`config/tiers.json` porte, par palier : ordre, libellés en 6 langues, mode de
paiement, prix, quotas (valeur décidée + **nom de la colonne
`app_settings`** qui reste la valeur appliquée, réglable dans le
back-office), comportement après quota, droits (estimation, courbe,
sources, export, lot, liens protégés, suggestions…), produits et packages
RevenueCat. Plus les packs de crédits et le coût des actions. Les points
non tranchés portent `"decision": "pending"`.

Branchement prévu (C3.1) :

1. le site : `web/lib/offers.ts` dérive `OFFERS_V4` du fichier (la page
   Tarifs, Torix et les tests ne changent pas d'API) ;
2. l'app : une copie générée `mobile/src/lib/tiers.generated.ts`, comme
   `design/generate.mjs` le fait pour les couleurs (l'app ne lit pas en
   dehors de `mobile/`) ;
3. les Edge Functions : `supabase/functions/_shared/tiers.ts` généré ;
4. les fiches de Torix (`knowledge.ts`) : leurs chiffres comparés au fichier
   par `torixKnowledge.test.ts`.

### 5.2 Correspondance RevenueCat, produits à créer ou renommer

Le code ne nomme **aucun entitlement** : le webhook lit `product_id`, l'app
lit `entitlements.active` sans filtre. À relever dans RevenueCat (D6).

| Palier | Entitlement (proposé) | Offering / package | Produit App Store | Produit Google Play | État |
| --- | --- | --- | --- | --- | --- |
| Premium mensuel | `premium` | current / `$rc_monthly` | `tiroir_premium_monthly` | idem (offre de base mensuelle) | existe ; prix à passer à 4,99 € |
| Premium annuel | `premium` | current / `$rc_annual` | `tiroir_premium_annual` | idem (offre de base annuelle) | existe ; prix 39 € **ou** 54,89 € selon D3 |
| Pro mensuel | `pro` | current / `pro_monthly` | `tiroir_pro_monthly` | idem | **à créer** (même groupe d'abonnements que Premium, niveau au-dessus) |
| Pro annuel | `pro` | current / `pro_annual` | `tiroir_pro_annual` | idem | **à créer si D3** (164,89 € avec « 1 mois offert ») |
| Crédits 50 | — | `credits` / pack 50 | `tiroir_credits_50` | idem (consommable) | **à créer** |
| Crédits 150 | — | `credits` / pack 150 | `tiroir_credits_150` | idem | **à créer** |
| Crédits 500 | — | `credits` / pack 500 | `tiroir_credits_500` | idem | **à créer** |
| Anciens packs 30 / 80 | — | — | `tiroir_credits_30`, `_80` | idem | **retirer de la vente, ne pas supprimer** (remboursements) |
| Business | — | hors stores | — | — | facture mensuelle (Stripe Billing sur le site, branche `claude/tiroir-credits-billing-9k30og`) |

Noms d'abonnements dans les stores : « Tiroir Premium » et « Tiroir Pro »
partout (noms propres, non traduits) ; descriptions traduites en annexe A.
Rien n'a été créé ni modifié : la procédure pas à pas reste
`strategie/packs-stores.md`, à compléter avec les lignes Pro annuel et les
langues pt-BR / pt-PT (aujourd'hui la checklist cite fr, en, da, de, es).

### 5.3 Paiement par palier

| Palier | Paiement | Où |
| --- | --- | --- |
| Free | crédits | app : achat intégré (RevenueCat) ; site : Stripe |
| Premium | abonnement | stores (RevenueCat) ; site : renvoi vers l'app |
| Pro | abonnement | stores (RevenueCat) ; plus tard site (Stripe) |
| Business | facture mensuelle | site / back-office |

### 5.4 Migration des comptes Premium existants, sans perte d'accès

Principe : **on n'enlève jamais un droit à un abonné en cours.**

1. **Avant toute bascule** (en preprod sur copie de la prod) : compter les
   profils `plan = 'premium'` par origine (store / manuel) et par produit
   RevenueCat ; lister ceux qui ont des quotas consommés au-dessus des
   nouveaux plafonds.
2. **Prix** : Premium passe de 6,99 € à 4,99 € — c'est une **baisse**, Apple
   et Google permettent de l'appliquer aux abonnés en cours sans
   consentement. Aucune hausse n'est prévue ; s'il y en avait une, les
   abonnés garderaient l'ancien prix (règle déjà écrite dans
   `strategie/offres.md`, point 6).
3. **Droits** : les fonctions Premium V4 (courbe, sources) s'ajoutent ; rien
   n'est retiré. Si D2 plafonne le quota Premium sous ce qu'un abonné
   consomme, appliquer le nouveau plafond **au prochain renouvellement**
   seulement.
4. **Webhook** : la nouvelle règle (`nextPlan` de `feat/stores-grille-v4`)
   ne réécrit un palier que sur un événement ; un abonné Premium sans
   événement reste Premium. Le Pro sur facture n'est jamais touché par les
   stores (déjà codé).
5. **Données V3 → V4** (D12) : uniquement des ajouts (`value_history`,
   colonnes de mot de passe salé, `profiles.locale`), rejoués en preprod, puis
   appliqués en prod par Clément. Aucune colonne supprimée pendant la V4.0.
6. **Communication** : e-mail aux abonnés (« votre prix baisse, rien ne
   change pour vous ») et message dans l'app, dans leur langue.
7. **Retour arrière** : la config des paliers est versionnée ; revenir à la
   grille précédente = revenir au commit précédent + redéployer le webhook.

### 5.5 Point de vigilance — crédits Stripe dans l'app iOS

Je signale, je ne tranche pas.

- **Règle Apple (App Review Guidelines § 3.1.1)** : un bien numérique
  consommé dans l'app — des crédits IA en sont un — doit être vendu par
  l'achat intégré. Un bouton ou un lien vers un paiement Stripe dans l'app
  iOS expose à un **refus en revue**, voire au retrait.
- **Exceptions qui bougent** : aux États-Unis, depuis la décision de justice
  d'avril 2025 (Epic c. Apple), les apps peuvent renvoyer vers un paiement
  externe ; dans l'Union européenne (DMA), Apple propose des droits de lien
  externe soumis à des frais et à des conditions. Ces règles évoluent :
  **à vérifier sur les textes en vigueur le jour de la décision**, idéalement
  avec un conseil.
- **Google Play** : même principe (facturation Play obligatoire pour les biens
  numériques), avec des programmes de facturation alternative selon les pays.
- **Options**

| Option | Ce que voit l'utilisateur iOS | Risque revue | Marge |
| --- | --- | --- | --- |
| A. Achat intégré seul dans l'app | packs au prix du store | nul | − 15 % (petits développeurs) ou 30 % |
| **B. Achat intégré dans l'app + Stripe sur le site, sans lien de l'app vers le site** | même solde partout ; l'app ne parle pas du site | faible si l'app ne mentionne ni le site ni ses prix | meilleure sur le site |
| C. Lien externe depuis l'app (États-Unis, UE) | choix du moyen de paiement | moyen, conditions par pays, frais Apple | variable |
| D. Stripe seul dans l'app | — | **élevé : refus probable** | — |

- **Constat** : la branche non fusionnée `claude/tiroir-credits-billing-9k30og`
  consigne une **décision du 26/10/2026 : option B**. Le brief la liste
  encore comme question ouverte : **à reconfirmer** (D8). Si B est confirmée,
  la checklist ISO doit tolérer un seul écart assumé : le prix d'un pack
  peut différer entre store et site — à trancher aussi (afficher le même
  prix partout est le plus simple et le plus sûr).

---

## 6. Chantier 4 — Web

| Sujet | Existant | À faire |
| --- | --- | --- |
| Homepage V2 | prototype `/v2` (branche `feat/homepage-v2` : Hero, Camille, GrandPublic, Offers, Values, animations `useMotion`) ; homepage actuelle `components/home/*` | partir du prototype : mobile d'abord, **pas de mockups 3D**, une vraie fiche objet animée (photo → fiche → estimation → partage), créatifs et pros d'abord, grand public rassuré ensuite ; respect de `prefers-reduced-motion` ; textes de l'annexe B |
| Tarifs | `pages/pricing.tsx` lit `OFFERS_V4` + `planQuotas` | lire `config/tiers.json` (via `offers.ts`) ; mention « annuel = 1 mois offert » pour Premium et Pro **une fois D3 tranchée** (aujourd'hui 39 €/an contredit cette mention) |
| Partage web | lecture seule, mot de passe, suggestions, « + » → inscription | mot de passe changeable / révocable (C2.3) ; limite d'essais sur `verify` ; vérifier prénom, nom d'utilisateur et photo de l'auteur d'une suggestion |
| Langues | 5 langues, homepage seule traduite en da/de/es, détection désactivée, sélecteur dans le pied de page (existe) | 6 langues (`pt-BR`, `pt-PT` comme sous-chemins `/pt-br`, `/pt-pt`), toutes les pages, **détection activée** une fois tout traduit, pages juridiques relues ; sort du danois selon D4 |
| Garde-fou ISO | — | § 8, en CI |

---

## 7. Chantier 5 — Marketing et marque Torix

### 7.1 Plateforme de message (français, référence)

- **Promesse** : *Sachez ce que vous avez. Montrez-le sans risque. Donnez-lui
  une seconde vie.*
- **Trois bénéfices**
  1. **Connaître** — une photo, et Torix rédige la fiche et estime la valeur.
     Même un inventaire incomplet est utile.
  2. **Montrer sans risque** — chaque partage est en lecture seule par défaut,
     vous choisissez ce qui est visible, et vous pouvez le couper à tout
     moment.
  3. **Faire circuler** — garder, prêter, revendre, transmettre : vous savez
     ce que vous avez avant de racheter.
- **Ton** : chaleureux, concret, tutoiement dans l'app (vouvoiement sur le site
  et dans les stores, comme aujourd'hui). On assume l'imparfait (« votre
  tiroir n'a pas besoin d'être rangé pour être utile »). **Jamais
  culpabilisant** : on ne reproche ni d'acheter ni d'accumuler.
- **Torix en une phrase** : *Torix est l'assistant de Tiroir : il lit vos
  photos, rédige les fiches et estime ce que valent vos objets.*
- **Torix en un paragraphe** : *Torix est l'intelligence qui fait tourner
  Tiroir. Vous photographiez un objet, il l'identifie, remplit la fiche
  (marque, modèle, état) et cherche ce qu'il vaut d'après des annonces
  comparables, sources à l'appui. Il propose, vous décidez : chaque
  information reste modifiable, et rien n'est partagé sans votre accord.*

### 7.2 Garde-fous appliqués à tous les textes

| Garde-fou | Ce qu'on écrit | Ce qu'on n'écrit pas |
| --- | --- | --- |
| Allégation sans preuve | « Torix lit vos photos et estime la valeur d'après des annonces comparables » | « IA officielle », « reconnue », « certifiée », « brevetée », « la plus précise » |
| Estimation | « une estimation, pas une expertise », « sources à l'appui » | « la vraie valeur », « garanti » |
| Greenwashing (directive européenne 2024/825 sur les allégations environnementales, loi Climat et résilience en France) | « réutiliser, prêter, revendre, éviter un achat » | « écologique », « bon pour la planète », « durable », tout chiffre de CO₂ sans méthode ni source |
| Confidentialité | « Vous seul voyez votre inventaire. Un partage montre ce que vous avez coché, en lecture seule, jusqu'à ce que vous le coupiez. » | « 100 % sécurisé », « inviolable » |

### 7.3 Qui voit quoi (texte de confidentialité, à reprendre partout)

> **Votre inventaire est privé.** Personne d'autre que vous ne le voit.
> **Quand vous partagez**, la personne qui a le lien voit uniquement les
> objets et les informations que vous avez cochés, en lecture seule. Vous
> pouvez ajouter un mot de passe, une date de fin, et couper le lien à tout
> moment. **Les suggestions** ne sont possibles que si vous les activez sur
> une collection ; leur auteur est identifié par son prénom, son nom
> d'utilisateur et sa photo.

Traductions : annexe B.

---

## 8. Checklist ISO web / mobile

À relancer à chaque version (automatisable en CI, étape C4.5 ; les lignes
marquées 🤖 le sont déjà en partie par `scripts/i18n-check.mjs` et
`web/__tests__/*.test.ts`).

### Langues
- [ ] 🤖 Les mêmes langues dans l'app (`SUPPORTED_LANGUAGES`) et sur le site (`next.config.js`).
- [ ] 🤖 Aucune clé manquante dans une langue complète de l'app ; variables `{{…}}` identiques.
- [ ] 🤖 Langues natives iOS / Android déclarées = langues de l'app.
- [ ] Textes système (caméra, photothèque) présents dans chaque langue.
- [ ] Pages juridiques du site disponibles dans chaque langue (ou repli annoncé).
- [ ] E-mails (partage, cycle de vie) dans chaque langue.
- [ ] Fiches store dans chaque langue (App Store : fr-FR, en-GB/en-US, es-ES, de-DE, pt-BR, pt-PT).

### Paliers et prix
- [ ] 🤖 Prix de `config/tiers.json` = `OFFERS_V4` = page Tarifs = fiches de Torix.
- [ ] 🤖 Packs de l'app = packs du webhook = packs de la page Tarifs.
- [ ] Prix des stores (App Store Connect, Play Console) = config (relevé manuel, captures).
- [ ] Prix Stripe = config (mode réel).
- [ ] Quotas de `app_settings` en prod = config (back-office, onglet Quotas).
- [ ] Mention « annuel = 1 mois offert » vraie pour chaque palier qui l'affiche.

### Fonctionnalités
- [ ] Chaque droit de `tiers.json` est ouvert dans l'app et décrit à l'identique sur le site.
- [ ] Partage : lecture seule, mot de passe, révocation, suggestions — mêmes options app et web.
- [ ] Libellés Torix identiques (« Estimation Torix ») sur l'app, le site, les stores.
- [ ] Aucune fonction annoncée sur le site qui n'existe pas dans l'app (et inversement).

### Garde-fous
- [ ] Aucun texte public avec « officiel », « reconnu », « certifié », « breveté », « écologique », « bon pour la planète ».
- [ ] Dans l'app iOS : aucun lien ni prix du site pour acheter (si option B).
- [ ] Aucune clé ni secret dans le code (`git grep -nE "sk_live|sk_test|service_role"` vide hors `.env.example`).

---

## 9. Décisions qui attendent Clément

| # | Décision | Options | Recommandation | Bloque |
| --- | --- | --- | --- | --- |
| D1 | Quelle branche porte la V4 ? | `claude/v4-holistique` (créée aujourd'hui) / une branche `v4` longue durée / autre | renommer en `v4` si tu veux une branche d'intégration unique | tout |
| D2 | **Quota Premium : plafonné ou illimité ?** | 150 actions (actuel) / plafond invisible / illimité | plafonné et affiché (le compteur est dans la spec ; l'annuel à 39 € perd déjà de l'argent au pire cas, `strategie/offres.md`) | C3.1, C2.2 |
| D3 | **Prix exacts** et règle de l'annuel | grille du 19/10 (Premium 39 €/an, pas de Pro annuel) / « 1 mois offert » (Premium 54,89 €, Pro 164,89 €) | trancher avant toute mention sur le site ; les deux sont dans `tiers.json` | C3, C4.2, annexe A |
| D4 | Danois | l'ajouter à l'app (7 langues) / le retirer du site | le retirer du site tant qu'il n'y a que la homepage (ISO, moins de textes à maintenir) | C1.5, C4.4 |
| D5 | **Sélecteur de langue** | maison / réglages système / les deux | **les deux** (§ 3.4) | — (fait en réversible) |
| D6 | Identifiants d'entitlements RevenueCat | à relever dans le tableau de bord | `premium` et `pro` | C3.2 |
| D7 | Torix, marque publique de l'IA de Tiroir | oui / non ; contrat de licence Torix → société avant de l'afficher dans les stores | oui, **après** le contrat de licence (`strategie/torix-et-tiroir.md` § 2) | C2.5, C5, publication |
| D8 | **Crédits sur iOS** | achat intégré / Stripe / les deux | reconfirmer l'option B du 26/10 (§ 5.5) ; et même prix partout ou non | C3.2, C4 |
| D9 | Régions d'estimation au lancement | 12 marchés listés / moins | FR, BE, CH, DE, ES, PT, BR d'abord | C1.4 |
| D10 | Défauts de partage | emplacement et assurance décochés par défaut ; expiration par défaut (30 jours ?) | décocher ; pas d'expiration imposée mais 30 jours présélectionné | C2.3 |
| D11 | API marchandes pour les idées d'objets | Amazon PA-API, Google Shopping, eBay Browse (neuf / occasion), Vinted et leboncoin (pas d'API publique) ; affiliation | eBay Browse (neuf + occasion, une seule API) pour commencer | C2.4 |
| D12 | **Migration des données V3 → V4** | additive seulement (proposé) / avec suppressions | additive, preprod d'abord, appliquée en prod par toi | C2.2, C2.3 |
| D13 | Liens protégés par mot de passe : pour tous ou Premium ? | ouverts à tous (code actuel) / Premium (grille du 19/10, `strategie/offres.md`) | **pour tous** : la sécurité par défaut ne doit pas être payante | C2.3, `tiers.json` |

### Choix réversibles faits dans cette session (à valider)

- Branche créée depuis `main` plutôt que reprise d'une branche existante.
- « IA » gardé pour les unités de compte, « Torix » pour l'acteur.
- Torix au masculin, comme dans `web/components/torix/`.
- pt-BR au registre « você » ; pt-PT au registre « você / o seu » (formel
  courant au Portugal), ce qui garde pt-PT court.
- Langue de l'appareil : Tiroir prend la **première langue de l'appareil qu'il sait parler** (avant : la première langue seulement, sinon l'anglais). Un téléphone réglé en italien puis français s'ouvre donc en français.
- Région par défaut : France si le pays de l'appareil n'est pas couvert
  (comportement actuel de l'estimation).
- E-mail de partage : portugais → anglais tant que le site n'a pas de page
  en portugais (le lien de l'e-mail ouvre alors `/en/s/…`).
- `CFBundleLocalizations` n'est plus écrit à la main dans `app.json` : le plugin
  `expo-localization` l'écrit (une seule déclaration, même liste pour Android).

---

## Annexe A — Textes des fiches store (6 langues)

Limites App Store : nom 30, sous-titre 30, texte promotionnel 170 caractères.
Prix non cités (ils viennent des stores). « Tiroir Premium » et « Tiroir Pro »
ne se traduisent pas.

### Français (fr-FR)

- **Sous-titre** : Vos objets, enfin sous la main
- **Texte promotionnel** : Nouveau : Estimation Torix. Une photo, et Torix rédige la fiche et estime la valeur d'après des annonces comparables, sources à l'appui.
- **Description**
  > Tiroir, c'est l'inventaire de ce que vous possédez, même incomplet.
  > Photographiez un objet : Torix, l'assistant de Tiroir, l'identifie, rédige la fiche et estime sa valeur d'après des annonces comparables.
  >
  > • Retrouvez n'importe quoi en quelques secondes, par collection ou en cherchant avec vos mots.
  > • Partagez une collection en lecture seule, avec un mot de passe si vous voulez, et coupez le lien quand vous voulez.
  > • Gardez, prêtez, revendez, transmettez : vous savez ce que vous avez avant de racheter.
  >
  > Gratuit : 20 actions IA par mois, puis des crédits si besoin.
  > Tiroir Premium : estimation automatique, courbe de valeur, sources.
  > Tiroir Pro : crédits IA inclus, détail des sources, export pour l'assureur, estimation en lot.
  >
  > Votre inventaire est privé. Un partage ne montre que ce que vous avez coché.
- **Nouveautés 4.0**
  > • Estimation Torix : l'estimation d'abord, vos ajustements ensuite, votre prix en dernier.
  > • Tiroir parle portugais (Brésil et Portugal).
  > • Langue et région séparées dans Paramètres › Préférences.
  > • Partages plus sûrs : lecture seule par défaut.
- **Abonnements** : *Tiroir Premium* — « Estimation automatique de vos objets, courbe de valeur et sources. » · *Tiroir Pro* — « Crédits IA inclus, détail des sources, export assurance et estimation en lot. » · *Pack de crédits* — « {n} crédits IA pour analyser, retoucher ou estimer vos objets. Les crédits n'expirent pas. »

### English (en-GB / en-US)

- **Subtitle**: Know what you own
- **Promotional text**: New: Torix estimate. Take a photo and Torix writes the entry and estimates its value from comparable listings, with sources.
- **Description**
  > Tiroir is an inventory of what you own — even an unfinished one.
  > Photograph an item: Torix, Tiroir's assistant, identifies it, writes the entry and estimates its value from comparable listings.
  >
  > • Find anything in seconds, by collection or by searching in your own words.
  > • Share a collection read-only, with a password if you like, and switch the link off whenever you want.
  > • Keep, lend, resell, pass on: know what you have before you buy again.
  >
  > Free: 20 AI actions a month, then credits if you need more.
  > Tiroir Premium: automatic estimates, value curve, sources.
  > Tiroir Pro: AI credits included, detailed sources, insurance export, batch estimates.
  >
  > Your inventory is private. A share only shows what you ticked.
- **What's new in 4.0**
  > • Torix estimate: the estimate first, your adjustments next, your price last.
  > • Tiroir now speaks Portuguese (Brazil and Portugal).
  > • Language and region are separate in Settings › Preferences.
  > • Safer shares: read-only by default.
- **Subscriptions**: *Tiroir Premium* — "Automatic estimates for your items, value curve and sources." · *Tiroir Pro* — "AI credits included, detailed sources, insurance export and batch estimates." · *Credit pack* — "{n} AI credits to analyse, enhance or estimate your items. Credits never expire."

### Español (es-ES)

- **Subtítulo**: Tus objetos, siempre a mano
- **Texto promocional**: Nuevo: Estimación Torix. Haz una foto y Torix redacta la ficha y estima su valor según anuncios comparables, con fuentes.
- **Descripción**
  > Tiroir es el inventario de lo que tienes, aunque esté incompleto.
  > Fotografía un objeto: Torix, el asistente de Tiroir, lo identifica, redacta la ficha y estima su valor según anuncios comparables.
  >
  > • Encuentra cualquier cosa en segundos, por colección o buscando con tus palabras.
  > • Comparte una colección en solo lectura, con contraseña si quieres, y desactiva el enlace cuando quieras.
  > • Guarda, presta, revende, regala: sabes lo que tienes antes de volver a comprar.
  >
  > Gratis: 20 acciones de IA al mes y, si hace falta, créditos.
  > Tiroir Premium: estimación automática, curva de valor, fuentes.
  > Tiroir Pro: créditos de IA incluidos, detalle de fuentes, exportación para el seguro, estimación por lotes.
  >
  > Tu inventario es privado. Un enlace solo muestra lo que has marcado.
- **Novedades 4.0**
  > • Estimación Torix: primero la estimación, luego tus ajustes, al final tu precio.
  > • Tiroir habla portugués (Brasil y Portugal).
  > • Idioma y región por separado en Ajustes › Preferencias.
  > • Enlaces más seguros: solo lectura por defecto.
- **Suscripciones**: *Tiroir Premium* — «Estimación automática de tus objetos, curva de valor y fuentes.» · *Tiroir Pro* — «Créditos de IA incluidos, detalle de fuentes, exportación para el seguro y estimación por lotes.» · *Pack de créditos* — «{n} créditos de IA para analizar, retocar o estimar tus objetos. No caducan.»

### Deutsch (de-DE)

- **Untertitel**: Wissen, was du besitzt
- **Werbetext**: Neu: Torix-Schätzung. Ein Foto, und Torix schreibt den Eintrag und schätzt den Wert anhand vergleichbarer Anzeigen – mit Quellen.
- **Beschreibung**
  > Tiroir ist das Inventar deiner Sachen – auch wenn es nicht vollständig ist.
  > Fotografiere ein Objekt: Torix, der Assistent von Tiroir, erkennt es, schreibt den Eintrag und schätzt den Wert anhand vergleichbarer Anzeigen.
  >
  > • Finde alles in Sekunden, nach Sammlung oder mit deinen eigenen Worten.
  > • Teile eine Sammlung nur zum Ansehen, auf Wunsch mit Passwort, und schalte den Link ab, wann du willst.
  > • Behalten, verleihen, weiterverkaufen, weitergeben: Du weißt, was du hast, bevor du neu kaufst.
  >
  > Kostenlos: 20 KI-Aktionen pro Monat, danach bei Bedarf Credits.
  > Tiroir Premium: automatische Schätzung, Wertverlauf, Quellen.
  > Tiroir Pro: KI-Credits inklusive, Quellen im Detail, Export für die Versicherung, Schätzung im Stapel.
  >
  > Dein Inventar ist privat. Ein Link zeigt nur, was du ausgewählt hast.
- **Neu in 4.0**
  > • Torix-Schätzung: erst die Schätzung, dann deine Anpassungen, zuletzt dein Preis.
  > • Tiroir spricht Portugiesisch (Brasilien und Portugal).
  > • Sprache und Region getrennt unter Einstellungen › Präferenzen.
  > • Sicherere Links: standardmäßig nur zum Ansehen.
- **Abos**: *Tiroir Premium* — „Automatische Schätzung deiner Objekte, Wertverlauf und Quellen.“ · *Tiroir Pro* — „KI-Credits inklusive, Quellen im Detail, Versicherungs-Export und Schätzung im Stapel.“ · *Credit-Paket* — „{n} KI-Credits zum Analysieren, Verbessern oder Schätzen deiner Objekte. Credits verfallen nicht.“

### Português (Brasil) (pt-BR)

- **Subtítulo**: Saiba o que você tem
- **Texto promocional**: Novo: Estimativa do Torix. Tire uma foto e o Torix cria a ficha e estima o valor com base em anúncios parecidos, com as fontes.
- **Descrição**
  > O Tiroir é o inventário do que você tem — mesmo incompleto.
  > Fotografe um objeto: o Torix, assistente do Tiroir, identifica, cria a ficha e estima o valor com base em anúncios parecidos.
  >
  > • Encontre qualquer coisa em segundos, por coleção ou buscando com suas palavras.
  > • Compartilhe uma coleção só para visualização, com senha se quiser, e desative o link quando quiser.
  > • Guarde, empreste, revenda, passe adiante: saiba o que você tem antes de comprar de novo.
  >
  > Grátis: 20 ações de IA por mês e, se precisar, créditos.
  > Tiroir Premium: estimativa automática, curva de valor, fontes.
  > Tiroir Pro: créditos de IA incluídos, fontes detalhadas, exportação para o seguro, estimativa em lote.
  >
  > Seu inventário é privado. Um link só mostra o que você marcou.
- **Novidades da 4.0**
  > • Estimativa do Torix: primeiro a estimativa, depois seus ajustes, por último o seu preço.
  > • O Tiroir agora fala português (Brasil e Portugal).
  > • Idioma e região separados em Configurações › Preferências.
  > • Links mais seguros: só visualização por padrão.
- **Assinaturas**: *Tiroir Premium* — “Estimativa automática dos seus objetos, curva de valor e fontes.” · *Tiroir Pro* — “Créditos de IA incluídos, fontes detalhadas, exportação para o seguro e estimativa em lote.” · *Pacote de créditos* — “{n} créditos de IA para analisar, retocar ou estimar seus objetos. Os créditos não expiram.”

### Português (Portugal) (pt-PT)

- **Subtítulo**: Saiba o que tem
- **Texto promocional**: Novidade: Estimativa do Torix. Tire uma fotografia e o Torix cria a ficha e estima o valor com base em anúncios semelhantes, com fontes.
- **Descrição**
  > O Tiroir é o inventário daquilo que tem — mesmo incompleto.
  > Fotografe um objeto: o Torix, o assistente do Tiroir, identifica-o, cria a ficha e estima o valor com base em anúncios semelhantes.
  >
  > • Encontre qualquer coisa em segundos, por coleção ou pesquisando com as suas palavras.
  > • Partilhe uma coleção só de leitura, com palavra-passe se quiser, e desative a ligação quando quiser.
  > • Guarde, empreste, revenda, passe a outros: saiba o que tem antes de voltar a comprar.
  >
  > Grátis: 20 ações de IA por mês e, se precisar, créditos.
  > Tiroir Premium: estimativa automática, curva de valor, fontes.
  > Tiroir Pro: créditos de IA incluídos, fontes detalhadas, exportação para a seguradora, estimativa em lote.
  >
  > O seu inventário é privado. Uma ligação só mostra o que assinalou.
- **Novidades da 4.0**
  > • Estimativa do Torix: primeiro a estimativa, depois os seus ajustes, por fim o seu preço.
  > • O Tiroir já fala português (Brasil e Portugal).
  > • Idioma e região separados em Definições › Preferências.
  > • Partilhas mais seguras: só de leitura por predefinição.
- **Subscrições**: *Tiroir Premium* — «Estimativa automática dos seus objetos, curva de valor e fontes.» · *Tiroir Pro* — «Créditos de IA incluídos, fontes detalhadas, exportação para a seguradora e estimativa em lote.» · *Pacote de créditos* — «{n} créditos de IA para analisar, retocar ou estimar os seus objetos. Os créditos não expiram.»

> Les lignes « Nouveautés » sur la courbe de valeur, l'export et le lot ne
> doivent partir **que si ces fonctions sont dans la version publiée**
> (chantier 2.2) ; sinon les retirer des descriptions.

---

## Annexe B — Textes marketing et in-app (6 langues)

Les accroches sont alignées : la même idée en homepage (H), en fiche store
(S, = sous-titre de l'annexe A) et à l'onboarding (O).

### B.1 Promesse, bénéfices, Torix

| | Promesse | Bénéfice 1 — Connaître | Bénéfice 2 — Montrer sans risque | Bénéfice 3 — Faire circuler |
| --- | --- | --- | --- | --- |
| fr | Sachez ce que vous avez. Montrez-le sans risque. Donnez-lui une seconde vie. | Une photo, et Torix rédige la fiche et estime la valeur. | Lecture seule par défaut, vous choisissez ce qui se voit. | Garder, prêter, revendre, transmettre plutôt que racheter. |
| en | Know what you own. Show it safely. Give it a second life. | One photo, and Torix writes the entry and estimates its value. | Read-only by default; you choose what's visible. | Keep, lend, resell, pass on — instead of buying again. |
| es | Sabe lo que tienes. Muéstralo sin riesgo. Dale una segunda vida. | Una foto, y Torix redacta la ficha y estima su valor. | Solo lectura por defecto; tú eliges qué se ve. | Guardar, prestar, revender, regalar en vez de volver a comprar. |
| de | Wisse, was du hast. Zeig es sicher. Gib ihm ein zweites Leben. | Ein Foto, und Torix schreibt den Eintrag und schätzt den Wert. | Standardmäßig nur zum Ansehen; du bestimmst, was sichtbar ist. | Behalten, verleihen, weiterverkaufen, weitergeben statt neu kaufen. |
| pt-BR | Saiba o que você tem. Mostre sem risco. Dê a ele uma segunda vida. | Uma foto, e o Torix cria a ficha e estima o valor. | Só visualização por padrão; você escolhe o que aparece. | Guardar, emprestar, revender, passar adiante em vez de comprar de novo. |
| pt-PT | Saiba o que tem. Mostre sem riscos. Dê-lhe uma segunda vida. | Uma fotografia, e o Torix cria a ficha e estima o valor. | Só de leitura por predefinição; escolhe o que se vê. | Guardar, emprestar, revender, passar a outros em vez de voltar a comprar. |

**Torix en une phrase**
- fr : Torix est l'assistant de Tiroir : il lit vos photos, rédige les fiches et estime ce que valent vos objets.
- en : Torix is Tiroir's assistant: it reads your photos, writes the entries and estimates what your items are worth.
- es : Torix es el asistente de Tiroir: lee tus fotos, redacta las fichas y estima cuánto valen tus objetos.
- de : Torix ist der Assistent von Tiroir: Er liest deine Fotos, schreibt die Einträge und schätzt, was deine Objekte wert sind.
- pt-BR : O Torix é o assistente do Tiroir: ele lê suas fotos, cria as fichas e estima quanto valem seus objetos.
- pt-PT : O Torix é o assistente do Tiroir: lê as suas fotografias, cria as fichas e estima quanto valem os seus objetos.

**Torix en un paragraphe**
- fr : Torix est l'intelligence qui fait tourner Tiroir. Vous photographiez un objet, il l'identifie, remplit la fiche (marque, modèle, état) et cherche ce qu'il vaut d'après des annonces comparables, sources à l'appui. Il propose, vous décidez : chaque information reste modifiable, et rien n'est partagé sans votre accord.
- en : Torix is the intelligence behind Tiroir. You photograph an item; it identifies it, fills in the entry (brand, model, condition) and looks up what it's worth from comparable listings, with sources. It suggests, you decide: every detail stays editable, and nothing is shared without your say.
- es : Torix es la inteligencia que mueve Tiroir. Fotografías un objeto; lo identifica, rellena la ficha (marca, modelo, estado) y busca cuánto vale según anuncios comparables, con fuentes. Él propone, tú decides: todo sigue siendo editable y nada se comparte sin tu permiso.
- de : Torix ist die Intelligenz hinter Tiroir. Du fotografierst ein Objekt; Torix erkennt es, füllt den Eintrag aus (Marke, Modell, Zustand) und ermittelt den Wert anhand vergleichbarer Anzeigen – mit Quellen. Torix schlägt vor, du entscheidest: Alles bleibt änderbar, und nichts wird ohne deine Zustimmung geteilt.
- pt-BR : O Torix é a inteligência por trás do Tiroir. Você fotografa um objeto; ele identifica, preenche a ficha (marca, modelo, estado) e pesquisa quanto vale com base em anúncios parecidos, com as fontes. Ele sugere, você decide: tudo continua editável e nada é compartilhado sem a sua permissão.
- pt-PT : O Torix é a inteligência por detrás do Tiroir. Fotografa um objeto; o Torix identifica-o, preenche a ficha (marca, modelo, estado) e procura quanto vale com base em anúncios semelhantes, com fontes. Ele sugere, o utilizador decide: tudo continua editável e nada é partilhado sem a sua autorização.

### B.2 Accroches alignées

| | Homepage (H1 + sous-titre) | Onboarding (titre + sous-titre) |
| --- | --- | --- |
| fr | **Vos objets, enfin sous la main.** Une photo, et Torix rédige la fiche, estime la valeur, et vous aide à prêter, revendre ou transmettre. Pour les créatifs, les pros, et tous ceux qui ont des tiroirs pleins. | **Retrouve ce que tu possèdes.** Une photo, Torix fait la fiche. Même un inventaire en vrac est utile. |
| en | **Your things, finally at hand.** One photo, and Torix writes the entry, estimates the value, and helps you lend, resell or pass things on. For creatives, pros and anyone with full drawers. | **Find what you own.** One photo, Torix does the entry. Even a messy inventory is useful. |
| es | **Tus objetos, por fin a mano.** Una foto, y Torix redacta la ficha, estima el valor y te ayuda a prestar, revender o regalar. Para creativos, profesionales y cualquiera con cajones llenos. | **Encuentra lo que tienes.** Una foto y Torix hace la ficha. Incluso un inventario desordenado sirve. |
| de | **Deine Sachen, endlich griffbereit.** Ein Foto, und Torix schreibt den Eintrag, schätzt den Wert und hilft dir beim Verleihen, Weiterverkaufen oder Weitergeben. Für Kreative, Profis und alle mit vollen Schubladen. | **Finde, was du besitzt.** Ein Foto, Torix erstellt den Eintrag. Auch ein unordentliches Inventar hilft. |
| pt-BR | **Seus objetos, finalmente à mão.** Uma foto, e o Torix cria a ficha, estima o valor e ajuda você a emprestar, revender ou passar adiante. Para criativos, profissionais e quem tem gavetas cheias. | **Encontre o que você tem.** Uma foto, e o Torix faz a ficha. Até um inventário bagunçado ajuda. |
| pt-PT | **Os seus objetos, finalmente à mão.** Uma fotografia, e o Torix cria a ficha, estima o valor e ajuda-o a emprestar, revender ou passar a outros. Para criativos, profissionais e quem tem gavetas cheias. | **Encontre o que tem.** Uma fotografia, e o Torix faz a ficha. Até um inventário desarrumado ajuda. |

### B.3 Messages in-app clés

Tutoiement en français, « você » en pt-BR, forme de politesse courante en pt-PT. `{n}` = nombre, `{date}` = date de remise à zéro.

**Fin de quota (Free)**
- fr : **Tes 20 actions IA du mois sont utilisées.** Elles reviennent le {date}. Pour continuer tout de suite, prends quelques crédits — ils n'expirent pas.
- en : **You've used this month's 20 AI actions.** They come back on {date}. To keep going now, grab a few credits — they never expire.
- es : **Has usado tus 20 acciones de IA del mes.** Vuelven el {date}. Para seguir ahora, compra unos créditos: no caducan.
- de : **Deine 20 KI-Aktionen für diesen Monat sind aufgebraucht.** Sie kommen am {date} zurück. Um gleich weiterzumachen, hol dir ein paar Credits – sie verfallen nicht.
- pt-BR : **Você usou as 20 ações de IA do mês.** Elas voltam em {date}. Para continuar agora, compre alguns créditos — eles não expiram.
- pt-PT : **Usou as 20 ações de IA deste mês.** Voltam a {date}. Para continuar já, compre alguns créditos — não expiram.

**Achat de crédits (confirmation)**
- fr : **Merci !** {n} crédits arrivent sur ton compte. Torix s'y remet quand tu veux.
- en : **Thank you!** {n} credits are on their way to your account. Torix is ready when you are.
- es : **¡Gracias!** {n} créditos llegan a tu cuenta. Torix sigue cuando quieras.
- de : **Danke!** {n} Credits sind unterwegs auf dein Konto. Torix macht weiter, wann du willst.
- pt-BR : **Obrigado!** {n} créditos estão chegando à sua conta. O Torix continua quando você quiser.
- pt-PT : **Obrigado!** {n} créditos estão a chegar à sua conta. O Torix continua quando quiser.

**Passage à Premium**
- fr : **Tu reviens souvent ?** Avec Tiroir Premium, Torix estime chaque objet tout seul, suit l'évolution de sa valeur et te montre ses sources.
- en : **Back for more?** With Tiroir Premium, Torix estimates every item on its own, tracks how its value changes and shows its sources.
- es : **¿Vuelves a menudo?** Con Tiroir Premium, Torix estima cada objeto solo, sigue cómo cambia su valor y te enseña sus fuentes.
- de : **Du bist oft hier?** Mit Tiroir Premium schätzt Torix jedes Objekt von selbst, verfolgt den Wertverlauf und zeigt dir seine Quellen.
- pt-BR : **Você volta sempre?** Com o Tiroir Premium, o Torix estima cada objeto sozinho, acompanha a evolução do valor e mostra as fontes.
- pt-PT : **Volta muitas vezes?** Com o Tiroir Premium, o Torix estima cada objeto sozinho, acompanha a evolução do valor e mostra as fontes.

**Passage à Pro**
- fr : **Un inventaire de métier ?** Tiroir Pro inclut les crédits IA, détaille chaque source, exporte pour ton assureur et estime tout un lot d'un coup.
- en : **A professional inventory?** Tiroir Pro includes AI credits, details every source, exports for your insurer and estimates a whole batch at once.
- es : **¿Un inventario profesional?** Tiroir Pro incluye créditos de IA, detalla cada fuente, exporta para tu aseguradora y estima un lote entero de una vez.
- de : **Ein berufliches Inventar?** Tiroir Pro enthält KI-Credits, zeigt jede Quelle im Detail, exportiert für deine Versicherung und schätzt einen ganzen Stapel auf einmal.
- pt-BR : **Um inventário profissional?** O Tiroir Pro inclui créditos de IA, detalha cada fonte, exporta para a sua seguradora e estima um lote inteiro de uma vez.
- pt-PT : **Um inventário profissional?** O Tiroir Pro inclui créditos de IA, detalha cada fonte, exporta para a sua seguradora e estima um lote inteiro de uma só vez.

### B.4 Qui voit quoi (confidentialité du partage)

- fr : Ton inventaire est privé. Un partage montre seulement ce que tu as coché, en lecture seule. Mot de passe, date de fin, coupure : c'est toi qui décides. Les suggestions ne sont possibles que si tu les actives ; leur auteur est identifié.
- en : Your inventory is private. A share only shows what you ticked, read-only. Password, end date, switch-off: you decide. Suggestions are only possible if you turn them on, and their author is identified.
- es : Tu inventario es privado. Un enlace solo muestra lo que has marcado, en solo lectura. Contraseña, fecha de fin, desactivar: decides tú. Las sugerencias solo son posibles si las activas, y su autor está identificado.
- de : Dein Inventar ist privat. Ein Link zeigt nur, was du ausgewählt hast, nur zum Ansehen. Passwort, Enddatum, Abschalten: Du entscheidest. Vorschläge gibt es nur, wenn du sie einschaltest, und ihr Autor ist erkennbar.
- pt-BR : Seu inventário é privado. Um link mostra só o que você marcou, apenas para visualização. Senha, data de término, desativar: quem decide é você. Sugestões só são possíveis se você ativar, e o autor é identificado.
- pt-PT : O seu inventário é privado. Uma ligação mostra apenas o que assinalou, só de leitura. Palavra-passe, data de fim, desativar: é o utilizador que decide. As sugestões só são possíveis se as ativar, e o autor é identificado.

> Toutes les traductions de cette annexe et de `pt-BR.json` / `pt-PT.json`
> sont à faire relire par un locuteur natif avant publication (C1.2).
