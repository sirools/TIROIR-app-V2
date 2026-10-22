// Sépare le back-office du site public selon le nom de domaine
// (voir lib/backofficeRouting.ts). Sans BACKOFFICE_HOST, ne fait rien.
import { NextResponse, type NextRequest } from 'next/server'
import { routeFor } from './lib/backofficeRouting'
import { asLocale, isRecipientPage, recipientLocale, untranslatedRedirect } from './lib/localeRouting'

export function middleware(req: NextRequest) {
  const route = routeFor(
    req.headers.get('host'),
    req.nextUrl.pathname,
    req.nextUrl.search,
    { backofficeHost: process.env.BACKOFFICE_HOST, siteHost: process.env.SITE_HOST },
    req.nextUrl.locale || 'fr',
  )

  if (route.action === 'redirect') return NextResponse.redirect(route.url, 307)

  // Destinataire d'un partage arrivé par un lien sans langue (/s/…) : on
  // le sert dans la langue de son navigateur, sauf s'il a déjà choisi une
  // langue dans le sélecteur du footer (cookie NEXT_LOCALE). Un lien qui
  // porte une autre langue que le français (/de/s/…) est respecté.
  if (route.action === 'next' && req.nextUrl.locale === 'fr' && isRecipientPage(req.nextUrl.pathname)) {
    const chosen = asLocale(req.cookies.get('NEXT_LOCALE')?.value)
    const lang = req.cookies.has('NEXT_LOCALE')
      ? (chosen === 'fr' ? null : chosen)
      : recipientLocale(req.headers.get('accept-language'))
    if (lang) {
      const url = req.nextUrl.clone()
      url.locale = lang
      return NextResponse.redirect(url, 307)
    }
  }

  // Danois, allemand, espagnol : seules les pages traduites sont servies.
  if (route.action === 'next') {
    const en = untranslatedRedirect(req.nextUrl.locale, req.nextUrl.pathname)
    if (en) {
      const url = req.nextUrl.clone()
      url.locale = 'en'
      url.pathname = en.slice(3)
      return NextResponse.redirect(url, 307)
    }
  }

  let res: NextResponse
  if (route.action === 'rewrite') {
    const url = req.nextUrl.clone()
    url.pathname = route.pathname
    res = NextResponse.rewrite(url)
  } else {
    res = NextResponse.next()
  }
  if ('noindex' in route && route.noindex) res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}

export const config = {
  // Ni les ressources de Next ni l'optimisation d'images. La racine est
  // listée à part : avec l'i18n, le motif général ne la couvre pas.
  matcher: ['/', '/((?!_next/static|_next/image).*)'],
}
