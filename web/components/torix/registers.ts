// Libellés des registres, sans rien du savoir de Torix : ce module peut
// partir dans le navigateur (voir pages/api/torix/ask.ts).
export type Register = 'fait' | 'estimation' | 'principe' | 'decision' | 'vecu'

export const REGISTER_LABELS: Record<Register, string> = {
  fait: 'Fait',
  estimation: 'Estimation',
  principe: 'Principe',
  decision: 'Décision',
  vecu: 'Vécu',
}
