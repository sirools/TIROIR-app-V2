# Back-office sur son propre domaine — backoffice.tiroir.app

Le back-office s'ouvre sur `backoffice.tiroir.app`, séparé du site public
`tiroir.app`. C'est le même site Next.js, qui répond selon le nom de
domaine (`middleware.ts`, logique dans `lib/backofficeRouting.ts`) :

| Domaine | Ce qu'on y trouve |
| --- | --- |
| `backoffice.tiroir.app` | `/` = l'admin. Aussi : `/admin/*` (Torix Lab…), la connexion et la récupération de mot de passe. Tout le reste renvoie vers `tiroir.app`. Jamais indexé. |
| `tiroir.app` | Le site public. `/admin` renvoie vers `backoffice.tiroir.app`. |

Les gardes serveur (`requireAdminPage`, `requireTorixPage`) restent la vraie
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
