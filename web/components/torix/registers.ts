// Libellés des registres, sans rien du savoir de Torix : ce module peut
// partir dans le navigateur (voir pages/api/torix/ask.ts).
export type Register = 'fait' | 'estimation' | 'principe'

export const REGISTER_LABELS: Record<Register, string> = {
  fait: 'Fait',
  estimation: 'Estimation',
  principe: 'Principe',
}
