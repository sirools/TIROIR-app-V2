// lib/shareCookieSignature.ts — signature du cookie d'accès à un partage.
// Serveur uniquement (node:crypto) : n'importer que depuis une route API ou
// un getServerSideProps.
//
// Le cookie historique vaut `${Date.now()}.ok` : n'importe qui peut le
// fabriquer et passer le mot de passe. En lecture seule, c'était toléré ;
// les suggestions ouvrent une écriture, qui exige donc une preuve signée.
//
// Nouveau format : `${ts}.${hmac}.ok`. Il se termine toujours par `.ok` et
// commence par l'horodatage : hasValidCookie (lecture) le lit sans
// changement.
//
// La signature couvre aussi l'empreinte du mot de passe du partage (`key`) :
// quand le propriétaire change le mot de passe, les sessions ouvertes avec
// l'ancien tombent aussitôt, au lieu de durer jusqu'à sept jours. Sans mot
// de passe, `key` est vide et la signature est celle d'avant.

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { GetServerSidePropsContext } from 'next'
import type { NextApiRequest } from 'next'
import { COOKIE_MAX_AGE_SEC, makeCookieName } from './shareAuth'

function secret(): string {
  // SHARE_COOKIE_SECRET permet de faire tourner la clé sans toucher Supabase ;
  // à défaut, la clé service (déjà secrète, déjà présente) suffit.
  const s = process.env.SHARE_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error('SHARE_COOKIE_SECRET manquant')
  return s
}

function sign(token: string, ts: number, key: string): string {
  // Sans clé, le message signé est celui d'avant : les cookies des partages
  // sans mot de passe restent valables.
  const message = key ? `${token}.${ts}.${key}` : `${token}.${ts}`
  return createHmac('sha256', secret()).update(message).digest('base64url')
}

/**
 * Valeur à poser dans le cookie après vérification du mot de passe.
 * `key` : l'empreinte du mot de passe du partage (options.password_hash).
 */
export function signedCookieValue(token: string, now = Date.now(), key: string | null | undefined = ''): string {
  return `${now}.${sign(token, now, key ?? '')}.ok`
}

/** Vrai si la valeur est un cookie signé, pour ce partage et son mot de passe actuel, encore frais. */
export function isSignedCookieValid(
  token: string,
  value: string | null | undefined,
  now = Date.now(),
  key: string | null | undefined = '',
): boolean {
  if (!value) return false
  const parts = value.split('.')
  if (parts.length !== 3 || parts[2] !== 'ok') return false
  const ts = Number(parts[0])
  if (!Number.isFinite(ts) || now - ts > COOKIE_MAX_AGE_SEC * 1000 || ts - now > 60_000) return false
  const expected = Buffer.from(sign(token, ts, key ?? ''))
  const given = Buffer.from(parts[1])
  return expected.length === given.length && timingSafeEqual(expected, given)
}

function cookieFrom(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...rest] = part.split('=')
    if (k?.trim() === name) return decodeURIComponent(rest.join('=').trim())
  }
  return null
}

export function hasSignedCookie(
  token: string,
  req: GetServerSidePropsContext['req'] | NextApiRequest,
  key: string | null | undefined = '',
): boolean {
  return isSignedCookieValid(token, cookieFrom(req.headers.cookie, makeCookieName(token)), Date.now(), key)
}
