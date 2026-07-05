import { createClient } from '@supabase/supabase-js'
import { createPagesBrowserClient, createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { GetServerSidePropsContext } from 'next'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svcRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client navigateur cookie-aware : nécessaire pour que la session soit
// lisible côté serveur (getServerSideProps) via serverSupabase().
export const supabase = createPagesBrowserClient({
  supabaseUrl: url,
  supabaseKey: anon,
})

export function serverSupabase(ctx: GetServerSidePropsContext) {
  return createServerSupabaseClient(ctx)
}

export function adminSupabase() {
  return createClient(url, svcRole)
}

/**
 * Déconnexion robuste, indépendante de la révocation serveur.
 *
 * `signOut()` par défaut (scope 'global') dépend d'un appel réseau qui peut
 * échouer et laisser la session locale intacte. Et surtout, un cookie de
 * session posé sur le domaine parent (`.tiroir.app` / apex) lors d'un accès
 * antérieur n'est pas effacé par le client quand on est sur `www.tiroir.app` :
 * l'utilisateur reste alors coincé connecté (constaté sur Chrome).
 *
 * On efface donc manuellement tous les cookies/localStorage Supabase (`sb-*`)
 * sur l'hôte courant ET ses domaines parents, en plus du signOut best-effort.
 */
export async function signOutEverywhere() {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* on se déconnecte quoi qu'il arrive */
  }
  if (typeof document === 'undefined') return

  // Domaines à cibler : host-only (undefined), l'hôte exact, et chaque
  // domaine parent (www.tiroir.app → .www.tiroir.app, .tiroir.app).
  const host = window.location.hostname
  const domains: (string | undefined)[] = [undefined, host]
  const parts = host.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    domains.push('.' + parts.slice(i).join('.'))
  }

  const cookieNames = document.cookie
    .split(';')
    .map(c => c.split('=')[0].trim())
    .filter(name => name.startsWith('sb-'))

  for (const name of cookieNames) {
    for (const domain of domains) {
      document.cookie =
        `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` +
        (domain ? `; domain=${domain}` : '')
    }
  }

  try {
    Object.keys(window.localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => window.localStorage.removeItem(k))
  } catch {
    /* localStorage indisponible : sans conséquence */
  }
}
