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
// changement, et les cookies déjà posés continuent d'ouvrir la page.

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

function sign(token: string, ts: number): string {
  return createHmac('sha256', secret()).update(`${token}.${ts}`).digest('base64url')
}

/** Valeur à poser dans le cookie après vérification du mot de passe. */
export function signedCookieValue(token: string, now = Date.now()): string {
  return `${now}.${sign(token, now)}.ok`
}

/** Vrai si la valeur est un cookie signé, pour ce partage, encore frais. */
export function isSignedCookieValid(token: string, value: string | null | undefined, now = Date.now()): boolean {
  if (!value) return false
  const parts = value.split('.')
  if (parts.length !== 3 || parts[2] !== 'ok') return false
  const ts = Number(parts[0])
  if (!Number.isFinite(ts) || now - ts > COOKIE_MAX_AGE_SEC * 1000 || ts - now > 60_000) return false
  const expected = Buffer.from(sign(token, ts))
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
): boolean {
  return isSignedCookieValid(token, cookieFrom(req.headers.cookie, makeCookieName(token)))
}
