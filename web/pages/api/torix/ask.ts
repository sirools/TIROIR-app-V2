// Torix répond ici, côté serveur : ses fiches (stratégie, coûts, doctrine…)
// ne partent jamais dans le code envoyé au navigateur. Réservé au
// propriétaire de Torix ; tout autre appelant reçoit un 404.
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireTorixOwnerApi } from '../../../lib/adminAuth'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { answerQuestion, UNKNOWN } from '../../../components/torix/knowledge'
import { answerFromSavoir, parseSavoir, STRONG_MATCH, type SavoirEntry } from '../../../lib/torixSavoir'

// savoir.md, le savoir de Clément : lu une fois par instance du serveur
// (inclus au déploiement par next.config.js, outputFileTracingIncludes).
let savoir: SavoirEntry[] | null = null
function loadSavoir(): SavoirEntry[] {
  if (savoir) return savoir
  try {
    savoir = parseSavoir(readFileSync(path.join(process.cwd(), 'components/torix/savoir.md'), 'utf8'))
  } catch {
    savoir = []
  }
  return savoir
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireTorixOwnerApi(req, res)
  if (!user) return
  if (req.method !== 'POST') return res.status(405).end()

  const question = typeof req.body?.question === 'string' ? req.body.question.trim().slice(0, 200) : ''
  if (!question) return res.status(400).json({ error: 'Question vide' })

  // Ce que Clément sait (savoir.md) passe devant quand la question le vise
  // nettement ; sinon les fiches sur Tiroir, puis savoir.md en recours.
  const strong = answerFromSavoir(question, loadSavoir(), STRONG_MATCH)
  if (strong) return res.status(200).json({ ...strong, known: true })
  const a = answerQuestion(question)
  if (a.text === UNKNOWN) {
    const s = answerFromSavoir(question, loadSavoir())
    if (s) return res.status(200).json({ ...s, known: true })
  }
  return res.status(200).json({ ...a, known: a.text !== UNKNOWN })
}
