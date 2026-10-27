// Point d'entrée des traductions du site (routage : i18n natif de Next,
// voir next.config.js et lib/localeRouting.ts). Les textes viennent de
// design/i18n/site/ (fichiers générés par node design/generate.mjs).
import { useRouter } from 'next/router'
import { asLocale, type Locale } from '../lib/localeRouting'
import fr, { type Copy } from './fr'
import en from './en'
import da from './da'
import de from './de'
import es from './es'
import { LANGUAGE_NAMES, LANGUAGE_INTL } from './languages.generated'

/** Accroche active de la homepage : 1, 2 ou 3 (textes dans chaque langue, home.hero.variants). */
export const HERO_VARIANT: 1 | 2 | 3 = 1

export const COPIES: Record<Locale, Copy> = { fr, en, da, de, es }

// Noms et balises Intl : design/i18n/languages.json (module généré).
export const LOCALE_NAMES = LANGUAGE_NAMES as Record<Locale, string>

/** Balise BCP 47 pour Intl (formats de prix, de dates, de nombres). */
const INTL = LANGUAGE_INTL as Record<Locale, string>

/** Balise Intl d'une langue du site, pour toLocaleDateString / toLocaleString. */
export const intlLocale = (locale: Locale) => INTL[locale]

export function useCopy(): { t: Copy; locale: Locale } {
  const locale = asLocale(useRouter().locale)
  return { t: COPIES[locale], locale }
}

/** Montant en euros au format de la langue (les prix du site sont en euros partout). */
export function formatEur(n: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL[locale], {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/** Remplace les marqueurs {clé} d'un texte. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

export type { Copy }
