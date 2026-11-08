// Langue d'un compte : gardée dans user_metadata.locale dès l'inscription,
// pour que les e-mails (confirmation, présentation, partage) et l'app
// parlent sa langue dès le premier jour.
//
// Sur le site, c'est la langue de la page d'inscription. Elle suit le
// point d'entrée : un lien de publication vers tiroir.app/de/… garde
// l'allemand jusqu'au formulaire. Dans l'app, c'est la langue de l'app.
//
// Module sans dépendance, testable.

import { LOCALES, type Locale } from './localeRouting'

/** Code de langue reconnu (« de-DE » → « de »), ou null. */
export function accountLocale(value: unknown): Locale | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toLowerCase().slice(0, 2)
  return (LOCALES as readonly string[]).includes(code) ? (code as Locale) : null
}
