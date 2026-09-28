// Faux Supabase pour tests locaux : /rest/v1 → PostgREST, /auth/v1 et
// /storage/v1 simulés. JWT HS256 signés avec SECRET.
import http from 'node:http'
import { createHmac } from 'node:crypto'
const SECRET = 'test-secret-test-secret-test-secret-00'
const USERS = {
  'ana@test.fr': 'aaaaaaaa-0000-0000-0000-000000000000',
  'bob@test.fr': 'bbbbbbbb-0000-0000-0000-000000000000',
  'chloe@test.fr': 'cccccccc-0000-0000-0000-000000000000',
}
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
export function jwt(payload) {
  const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(payload)
  return `${h}.${p}.${createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`
}
function verify(tok) {
  const [h, p, s] = (tok || '').split('.')
  if (!s || createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null
  return JSON.parse(Buffer.from(p, 'base64url').toString())
}
function userOf(id) {
  const email = Object.keys(USERS).find(e => USERS[e] === id)
  return { id, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
}
function session(id) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  return { access_token: jwt({ sub: id, role: 'authenticated', aud: 'authenticated', exp }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r-' + id, user: userOf(id) }
}
const send = (res, code, body, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', ...headers }); res.end(typeof body === 'string' ? body : JSON.stringify(body)) }
const readBody = req => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)) })

if (process.argv[2] === 'keys') {
  console.log(`ANON=${jwt({ role: 'anon', exp: 2e9 })}\nSERVICE=${jwt({ role: 'service_role', exp: 2e9 })}`)
  process.exit(0)
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS') return send(res, 204, '')
  if (url.pathname.startsWith('/rest/v1/')) {
    const body = await readBody(req)
    const headers = { ...req.headers }; delete headers.host; delete headers['content-length']
    const up = await fetch('http://127.0.0.1:3001' + req.url.slice('/rest/v1'.length), { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body })
    const text = await up.text()
    const h = {}; for (const k of ['content-type', 'content-range']) if (up.headers.get(k)) h[k] = up.headers.get(k)
    return send(res, up.status, text, h)
  }
  if (url.pathname === '/auth/v1/token') {
    const body = JSON.parse((await readBody(req)) || '{}')
    if (url.searchParams.get('grant_type') === 'password') {
      const id = USERS[body.email]
      return id ? send(res, 200, session(id)) : send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
    }
    if (url.searchParams.get('grant_type') === 'refresh_token') return send(res, 200, session(String(body.refresh_token).slice(2)))
  }
  if (url.pathname === '/auth/v1/user') {
    const claims = verify((req.headers.authorization || '').replace('Bearer ', ''))
    return claims?.role === 'authenticated' ? send(res, 200, userOf(claims.sub)) : send(res, 401, { msg: 'invalid JWT' })
  }
  if (url.pathname === '/auth/v1/logout') return send(res, 204, '')
  if (url.pathname.startsWith('/storage/v1/object/sign/')) {
    if (req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}')
      return send(res, 200, (body.paths || []).map(p => ({ path: p, signedURL: `/object/sign/object-images/${p}?token=x`, error: null })))
    }
    return send(res, 200, `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#8AB4F8"/><text x="32" y="40" font-size="24" text-anchor="middle">B</text></svg>`, { 'content-type': 'image/svg+xml' })
  }
  send(res, 404, { error: 'not mocked', path: url.pathname })
}).listen(54321, () => console.log('fake supabase on 54321'))
