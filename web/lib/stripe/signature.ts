// Vérification de la signature d'un webhook Stripe (en-tête
// Stripe-Signature : « t=<horodatage>,v1=<hmac>,… »), sans le SDK.
// HMAC-SHA256 de « <t>.<corps brut> » avec le secret de l'endpoint
// (whsec_…), comparé en temps constant ; un horodatage de plus de
// 5 minutes est refusé (rejeu).
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SIGNATURE_TOLERANCE_S = 300

export function signPayload(payload: string, secret: string, timestamp: number): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex')
}

export function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  nowS: number = Math.floor(Date.now() / 1000),
  toleranceS: number = SIGNATURE_TOLERANCE_S,
): boolean {
  if (!header || !secret) return false
  let timestamp: number | null = null
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2).map(s => s?.trim())
    if (k === 't' && v && /^\d+$/.test(v)) timestamp = Number(v)
    else if (k === 'v1' && v) signatures.push(v)
  }
  if (timestamp === null || signatures.length === 0) return false
  if (Math.abs(nowS - timestamp) > toleranceS) return false

  const expected = Buffer.from(signPayload(payload, secret, timestamp), 'hex')
  return signatures.some(sig => {
    const given = Buffer.from(sig, 'hex')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}
