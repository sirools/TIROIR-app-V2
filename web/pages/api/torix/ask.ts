// Torix répond ici, côté serveur : ses fiches (stratégie, coûts, doctrine…)
// ne partent jamais dans le code envoyé au navigateur. Réservé au
// propriétaire de Torix ; tout autre appelant reçoit un 404.
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireTorixOwnerApi } from '../../../lib/adminAuth'
import { answerQuestion, UNKNOWN } from '../../../components/torix/knowledge'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireTorixOwnerApi(req, res)
  if (!user) return
  if (req.method !== 'POST') return res.status(405).end()

  const question = typeof req.body?.question === 'string' ? req.body.question.trim().slice(0, 200) : ''
  if (!question) return res.status(400).json({ error: 'Question vide' })

  const a = answerQuestion(question)
  return res.status(200).json({ ...a, known: a.text !== UNKNOWN })
}
