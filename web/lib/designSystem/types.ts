// Types et constantes de la page « Design system », sans données : ce
// module part dans le navigateur. L'inventaire lui-même (tous les textes)
// reste sur le serveur, dans inventory.ts.
export type Support = 'web' | 'native'

export type Language = {
  code: string
  name: string
  app: boolean
  site: boolean
  fallback?: string
}

type RawComponent = {
  file: string
  name: string
  kind: string
  group: string
  also?: string[]
  sub?: string[]
  perLanguage?: string
  keys: string[]
  dynamic?: string[]
  whole?: string[]
  hardcoded: number
  /** Page du site ou écran de l'app : ouvert par son adresse. */
  entry?: boolean
  usedBy: string[]
}

export type { RawComponent }

/** Un texte affiché par un composant, dans la langue choisie. */
export type TextRow = {
  key: string
  /** null : absent de la langue (et de sa langue mère). */
  value: string | null
  /** Langue mère d'où vient le texte, pour une langue partielle (pt-PT → pt-BR). */
  from?: string
  /** Texte de référence (français), quand la langue choisie en est une autre. */
  ref?: string
}

export type ComponentView = Omit<RawComponent, 'keys'> & {
  texts: TextRow[]
  missing: number
}

export type SupportSummary = {
  components: number
  texts: number
  /** La langue choisie est-elle proposée sur ce support ? */
  available: boolean
  /** Textes présents dans la langue choisie (langue mère comprise). */
  covered: number
  unusedKeys: number
}

export type DesignSystemView = {
  lang: string
  reference: string
  support: Support
  languages: Language[]
  summary: Record<Support, SupportSummary>
  components: ComponentView[]
}

export const SUPPORTS: Support[] = ['web', 'native']

export const isSupport = (v: unknown): v is Support => v === 'web' || v === 'native'

