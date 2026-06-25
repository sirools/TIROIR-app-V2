// apps/next/lib/shareAuth.ts

import type { GetServerSidePropsContext, NextPageContext } from 'next'

export const COOKIE_PREFIX = 'tiroir_share_'
export const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 jours

export function makeCookieName(slug: string) {
  return `${COOKIE_PREFIX}${slug}`
}

function parseCookieHeader(header?: string) {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const [k, ...rest] = part.split('=')
    if (!k) continue
    out[k.trim()] = decodeURIComponent((rest.join('=') || '').trim())
  }
  return out
}

export function readCookieFromCtx(
  ctx: GetServerSidePropsContext | NextPageContext,
  name: string
): string | null {
  const header =
    // @ts-ignore both types have req.headers.cookie at runtime
    ctx?.req?.headers?.cookie || ''
  const jar = parseCookieHeader(header)
  return jar[name] ?? null
}

/**
 * Valide si un cookie d’accès est présent et (optionnellement) récent.
 * Le format que nous écrivons côté API est: `${Date.now()}.ok`
 */
export function hasValidCookie(
  slug: string,
  ctx: GetServerSidePropsContext | NextPageContext
) {
  const name = makeCookieName(slug)
  const value = readCookieFromCtx(ctx, name)
  if (!value) return false

  // Tolérant : si finit par ".ok", on accepte.
  if (value.endsWith('.ok')) {
    // Si le timestamp est présent en préfixe, on peut vérifier la fraîcheur.
    const ts = Number(value.split('.')[0])
    if (Number.isFinite(ts)) {
      const fresh = Date.now() - ts < COOKIE_MAX_AGE_SEC * 1000
      return fresh
    }
    return true
  }
  return false
}