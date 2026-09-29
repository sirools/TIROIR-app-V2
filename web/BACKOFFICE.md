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
