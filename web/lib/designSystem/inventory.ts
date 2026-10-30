// Inventaire des composants du site et de l'app, pour la page « Design
// system » du back-office (pages/admin/design-system.tsx).
//
// Lu seulement dans getServerSideProps : le fichier généré (tous les textes
// dans toutes les langues) reste sur le serveur ; la page ne reçoit que la
// langue et le support demandés. Source : design/components.mjs, via
// `node design/generate.mjs`.
import inventory from './inventory.generated.json'
import {
  SUPPORTS,
  isSupport,
  type ComponentView,
  type DesignSystemView,
  type Language,
  type RawComponent,
  type Support,
  type SupportSummary,
  type TextRow,
} from './types'

export * from './types'

type RawSupport = {
  components: RawComponent[]
  texts: Record<string, Record<string, string>>
  totalKeys: number
  unusedKeys: number
}

type Raw = {
  reference: string
  languages: Language[]
  web: RawSupport
  native: RawSupport
}

const RAW = inventory as unknown as Raw

/** Ordre des familles : parcours de l'utilisateur d'abord, briques et structure ensuite. */
const GROUP_ORDER: Record<Support, string[]> = {
  web: ['Vitrine', 'Compte', 'Partage', 'À propos et juridique', 'Erreurs', 'Mise en page', 'Commun', 'Torix', 'Back-office', 'Structure'],
  native: ['Accueil', 'Connexion', 'Capture', 'Objets', 'Collections', 'Recherche', 'Partage', 'Torix', 'Offres', 'Réglages', 'Autres écrans', 'Composants métier', 'Briques UI', 'Structure'],
}

const rank = (support: Support, group: string) => {
  const i = GROUP_ORDER[support].indexOf(group)
  return i === -1 ? GROUP_ORDER[support].length : i
}

const offered = (l: Language, support: Support) => (support === 'web' ? l.site : l.app)

function resolve(texts: Record<string, string>, lang: Language | undefined, languages: Language[]) {
  if (!lang) return { value: null as string | null }
  if (texts[lang.code] !== undefined) return { value: texts[lang.code] }
  let parent = lang.fallback
  while (parent) {
    if (texts[parent] !== undefined) return { value: texts[parent], from: parent }
    parent = languages.find(l => l.code === parent)?.fallback
  }
  return { value: null as string | null }
}

/** Textes et composants d'un support, dans une langue (inconnue → référence). */
export function designSystemView(langParam: unknown, supportParam: unknown, raw: Raw = RAW): DesignSystemView {
  const languages = raw.languages
  const lang = languages.find(l => l.code === langParam)?.code ?? raw.reference
  const support: Support = isSupport(supportParam) ? supportParam : 'web'
  const language = languages.find(l => l.code === lang)

  const summary = Object.fromEntries(SUPPORTS.map(s => {
    const data = raw[s]
    const available = !!language && offered(language, s)
    const keys = Object.keys(data.texts)
    const covered = available ? keys.filter(k => resolve(data.texts[k], language, languages).value !== null).length : 0
    return [s, { components: data.components.length, texts: keys.length, available, covered, unusedKeys: data.unusedKeys }]
  })) as Record<Support, SupportSummary>

  const data = raw[support]
  const available = summary[support].available
  const ordered = [...data.components].sort((a, b) =>
    rank(support, a.group) - rank(support, b.group) || a.group.localeCompare(b.group, 'fr') || a.file.localeCompare(b.file))
  const components = ordered.map(({ keys, ...c }) => {
    const texts: TextRow[] = keys.map(key => {
      const all = data.texts[key] ?? {}
      const ref = all[raw.reference]
      // Langue absente de ce support : on montre la référence, signalée par la page.
      if (!available) return { key, value: ref ?? null }
      const r = resolve(all, language, languages)
      return {
        key,
        value: r.value,
        ...(r.from ? { from: r.from } : {}),
        ...(lang !== raw.reference && ref !== undefined ? { ref } : {}),
      }
    })
    return { ...c, texts, missing: available ? texts.filter(t => t.value === null).length : 0 }
  })

  return { lang, reference: raw.reference, support, languages, summary, components }
}
