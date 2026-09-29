// Après connexion : le propriétaire de Torix choisit entre Tiroir et Torix ;
// tous les autres vont directement dans Tiroir. Cette route ne dit rien à
// personne d'autre : même 404 que toute route de Torix (requireTorixOwnerApi).
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireTorixOwnerApi } from '../../../lib/adminAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireTorixOwnerApi(req, res)
  if (!user) return
  return res.status(200).json({ owner: true })
}
