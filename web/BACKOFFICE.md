# Back-office sur son propre domaine — backoffice.tiroir.app

Le back-office s'ouvre sur `backoffice.tiroir.app`, séparé du site public
`tiroir.app`. C'est le même site Next.js, qui répond selon le nom de
domaine (`middleware.ts`, logique dans `lib/backofficeRouting.ts`) :

| Domaine | Ce qu'on y trouve |
| --- | --- |
| `backoffice.tiroir.app` | `/` = l'admin. Aussi : `/admin/*` (Torix Lab pour son seul propriétaire…), la connexion et la récupération de mot de passe. Tout le reste renvoie vers `tiroir.app`. Jamais indexé. |
| `tiroir.app` | Le site public. `/admin` renvoie vers `backoffice.tiroir.app`. |

Les gardes serveur (`requireAdminPage`, `requireTorixOwnerPage`) restent la vraie
protection : un compte non admin reçoit toujours un 404, quel que soit le
domaine. La session est propre à chaque domaine : on se connecte une fois
sur le back-office.

## Activer (une fois)

Tant que `BACKOFFICE_HOST` n'est pas défini, rien ne change.

1. **Vercel → projet web → Settings → Domains** : ajouter
   `backoffice.tiroir.app` (même projet, même branche `main`).
2. **DNS de `tiroir.app`** : créer l'enregistrement que Vercel indique
   (en général un `CNAME backoffice → cname.vercel-dns.com`).
3. **Vercel → Settings → Environment Variables**, pour **Production** :
   `BACKOFFICE_HOST=backoffice.tiroir.app`
   (facultatif : `SITE_HOST`, par défaut `tiroir.app`).
4. **Supabase (prod) → Authentication → URL Configuration → Redirect URLs** :
   ajouter `https://backoffice.tiroir.app/**` — nécessaire pour la
   connexion Google / Apple depuis le back-office.
5. **Redéployer** la production (Deployments → Redeploy), pour que la
   variable soit prise en compte.

## Vérifier

- `https://backoffice.tiroir.app` → page de connexion, puis l'admin.
- `https://tiroir.app/admin` → renvoie vers `https://backoffice.tiroir.app/`.
- `https://backoffice.tiroir.app/pricing` → renvoie vers `https://tiroir.app/pricing`.

## Revenir en arrière

Supprimer `BACKOFFICE_HOST` dans Vercel et redéployer : `/admin` redevient
accessible sur `tiroir.app`, comme avant.

## Le système tourne-t-il ? (24 h / 24)

Le site, le back-office et la base tournent jour et nuit. **Seul Torix se
repose** (21 h 30 – 7 h) : son repos ne coupe rien d'autre.

- **En haut du back-office**, la carte « État du système » : système en
  ligne, base de données qui répond, et — pour le seul propriétaire —
  Torix éveillé ou au repos. Revérifiée chaque minute.
- **`https://tiroir.app/api/health`** : `{"status":"ok","site":"ok","db":"ok"}`
  (HTTP 200) quand tout va bien ; HTTP 503 si la base ne répond pas.

### Être alerté sur son iPhone (gratuit, une fois)

1. Créer un compte sur un service de surveillance gratuit (UptimeRobot,
   Better Stack…).
2. Nouveau moniteur HTTP(S) : `https://tiroir.app/api/health`, toutes les
   5 minutes.
3. Installer l'app du service sur l'iPhone et activer les notifications :
   une alerte arrive si le site ou la base tombe, et une autre quand ça
   repart.

## Page Marketing (`/admin/marketing`)

Chiffres agrégés pour qui s'occupe de la marque et de la publicité :
visiteurs, comptes, activation, abonnés payants, inscriptions par source
(`lib/attribution.ts`). Rien de secret : ni Torix, ni coûts, ni
trésorerie, ni adresse ou objet d'un utilisateur.

Ouverte aux admins et aux adresses de la variable serveur
**`MARKETING_EMAILS`** (Vercel → Settings → Environment Variables,
adresses séparées par des virgules), qui n'ont accès à rien d'autre du
back-office. L'adresse doit être confirmée. Garde :
`requireMarketingPage` (`lib/adminAuth.ts`).

## Header du back-office (navigation commune)

Un seul header, sticky, sur toutes les pages admin : logo (retour à
l'accueil), une entrée par section (l'active en orange, sous-pages
comprises), « Voir le site » (accueil de `tiroir.app`, adresse calculée
par `siteUrlFor` dans `lib/adminNav.ts`), compte et déconnexion ; sous
760 px, un menu compact. Sur les sous-pages, un fil d'Ariane
(Back-office › Marketing › Campagnes). Dans l'autre sens, le menu compte
du header du site public a une entrée Admin (`/admin`, qui renvoie vers
le back-office) — visible si l'on est connecté en admin sur `tiroir.app`,
la session étant propre à chaque domaine.

- `components/admin/AdminLayout.tsx` — le header, posé **une seule fois**
  par `pages/_app.tsx` autour de toute page qui renvoie `adminNav`.
- `lib/adminNav.ts` — la liste des sections et qui les voit (lue
  seulement par le serveur). Un compte ne voit que ce que ses gardes lui
  ouvrent : Torix Lab pour son seul propriétaire, Marketing seul pour
  `MARKETING_EMAILS`.
- `components/admin/adminNavPaths.ts` — onglet actif et fil d'Ariane.

Le header ne protège rien : les gardes (`lib/adminAuth.ts`) restent la
vraie protection. Sans garde passée, pas de `adminNav`, donc pas de header.

### Ajouter une section

1. `lib/adminNav.ts`, tableau `SECTIONS` : une ligne, par exemple
   `{ key: 'support', label: 'Support', href: '/admin/support', visible: a => a.isAdmin }`.
   `visible` doit refléter la garde de la page. Facultatif : `pages`
   (libellés du fil d'Ariane, ex. `{ tickets: 'Tickets' }`), `tone: 'dark'`.
2. La page (`pages/admin/support.tsx`, et ses sous-pages
   `pages/admin/support/…`) appelle sa garde puis renvoie
   `adminNav: adminNavFor(guard.user, guard.isAdmin)` dans ses props.

Rien d'autre : l'onglet, l'état actif, le menu mobile et le fil d'Ariane
suivent.
