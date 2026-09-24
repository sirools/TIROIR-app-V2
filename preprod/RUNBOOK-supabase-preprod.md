# Runbook — Supabase de preprod pour Tiroir

Objectif : un **projet Supabase dédié** (isolé de la prod) qui alimente la preprod Tiroir
hébergée sur le NAS. Aucune donnée de prod n'est touchée.

## 0. Prérequis
- Supabase CLI installé (`brew install supabase/tap/supabase`).
- Accès au repo (dossier `supabase/` : 71 migrations + 13 edge functions).

## 1. Créer le projet dédié (toi, dans le dashboard)
1. https://supabase.com/dashboard → **New project**.
2. Nom : `tiroir-preprod`. Région : proche (eu-west). Note le **mot de passe DB**.
3. Une fois créé, récupère dans **Project Settings → API** :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (secret)
   - Le **ref** du projet (dans l'URL du dashboard) pour le CLI.

## 2. Appliquer le schéma (71 migrations)
```bash
cd /Users/clementougier/TIROIR-app-V2
supabase link --project-ref <ref-preprod>     # se connecter au projet preprod
supabase db push                               # rejoue toutes les migrations
```
> ⚠️ Bien vérifier que `link` pointe sur **preprod**, pas la prod, avant `db push`.

## 3. Déployer les 13 edge functions
```bash
supabase functions deploy --project-ref <ref-preprod>
# ou une par une : supabase functions deploy describe-object --project-ref <ref-preprod>
```
Functions : assistant-chat, chat-turn, create-share-link, delete-account,
describe-object, detect-scene, enhance-object-photo, estimate-value,
mock-draft-pending, resend-webhook, revenuecat-webhook, scene-thumbnail,
send-lifecycle-emails.

## 4. Secrets des edge functions (valeurs de preprod)
Secrets réellement attendus par le code (relevé dans `supabase/functions`) :
```bash
supabase secrets set --project-ref <ref-preprod> \
  ANTHROPIC_API_KEY=...        \  # IA (description, chat…)
  GEMINI_API_KEY=...           \  # IA (scène, estimation…)
  RESEND_API_KEY=...           \  # emails transactionnels
  RESEND_WEBHOOK_SECRET=...    \  # webhook Resend
  REVENUECAT_WEBHOOK_SECRET=...   # webhook abonnements
```
> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont **injectés
> automatiquement** par la plateforme dans les functions — ne pas les définir à la main.
> Utiliser des **clés de test / preprod** (surtout pour les providers payants).

## 5. Storage & Auth
- Le bucket + policies sont créés par la migration `..._storage_and_policies.sql` (déjà via `db push`).
- **Auth** : Dashboard → Authentication → URL Configuration → ajouter
  `http://192.168.1.23:8151` (et l'URL finale de la preprod) en *Redirect URLs* / *Site URL*.

## 6. Renseigner l'app
Copier `preprod/tiroir/.env.preprod.example` → `preprod/tiroir/.env.preprod`
et remplir avec les valeurs de l'étape 1 + secrets générés
(`SHARE_LINK_SECRET`, `ANALYTICS_SALT` via `openssl rand -hex 32`).

## 7. (Données de test, optionnel)
Ne pas importer les vraies données. Créer un compte de test via l'app, ou un petit
script de seed. Pour un dump anonymisé : à définir séparément (ne jamais copier des PII de prod).

---
Une fois 1→6 faits + le disque du NAS en place, lancer :
`cd preprod && ./deploy.sh clementougier@192.168.1.23`
