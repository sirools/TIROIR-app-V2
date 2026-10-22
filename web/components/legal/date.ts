import { intlLocale } from '../../locales'
import type { Locale } from '../../lib/localeRouting'

/**
 * Date de mise à jour d'un document (AAAA-MM-JJ) écrite dans la langue de
 * la page. Fuseau UTC : même rendu au serveur et au navigateur.
 */
export function formatLegalDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(intlLocale(locale), {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}
