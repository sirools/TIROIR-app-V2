// Faux Supabase du banc e2e de l'essai sans compte. Tout est local :
//   /rest/v1      → traduit en SQL et joué par psql sur la base jetable
//                   (le brouillon essai_sans_compte.sql y tourne pour de bon) ;
//   /auth/v1      → comptes en mémoire, JWT HS256 ;
//   /storage/v1   → fichiers en mémoire ;
//   /functions/v1/trial-estimate → même protocole que la fonction Edge
//                   (clé service seule, tentative réservée en base), sans
//                   appel à un modèle : une photo minuscule « n'est pas un
//                   objet », les autres sont une lampe à 120 €.
// Ne sert qu'aux tests : aucune requête n'est protégée contre l'injection.
import http from 'node:http'
import { createHmac, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const DB = process.env.E2E_DB
const SECRET = 'test-secret-test-secret-test-secret-00'
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
export function jwt(payload) {
  const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(payload)
  return `${h}.${p}.${createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`
}
const SERVICE = jwt({ role: 'service_role', exp: 2e9 })
if (process.argv[2] === 'keys') {
  console.log(`ANON=${jwt({ role: 'anon', exp: 2e9 })}\nSERVICE=${SERVICE}`)
  process.exit(0)
}
function claimsOf(req) {
  const [h, p, s] = String(req.headers.authorization || '').replace('Bearer ', '').split('.')
  if (!s || createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null
  return JSON.parse(Buffer.from(p, 'base64url').toString())
}

const users = new Map()   // id → { id, email, password, user_metadata, confirmed }
const files = new Map()   // « bucket/chemin » → Buffer
export const calls = { estimate: 0 }

const userView = u => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: u.user_metadata, created_at: '2026-11-14T00:00:00Z', email_confirmed_at: u.confirmed ? '2026-11-14T00:00:00Z' : null })
function session(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  return { access_token: jwt({ sub: u.id, role: 'authenticated', aud: 'authenticated', exp }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r-' + u.id, user: userView(u) }
}

const lit = v => v === null || v === undefined ? 'NULL' : `'${(typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/'/g, "''")}'`
const ident = s => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`identifiant refusé : ${s}`); return s }
function sql(statement, claims) {
  // « auth » : le service d'authentification lui-même (création d'un compte).
  const role = claims === 'auth' ? ''
    : claims?.role === 'authenticated'
      ? `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', ${lit(claims.sub)}, false);`
      : 'SET ROLE service_role;'
  const out = execFileSync('psql', [DB, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', `${role} ${statement}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return out.split('\n').filter(Boolean).pop() ?? 'null'
}
function where(params) {
  const parts = []
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns'].includes(k)) continue
    const [op, ...rest] = v.split('.'); const value = rest.join('.')
    if (op === 'eq') parts.push(`${ident(k)} = ${lit(value)}`)
    else if (op === 'lt') parts.push(`${ident(k)} < ${lit(value)}`)
    else if (op === 'is' && value === 'null') parts.push(`${ident(k)} IS NULL`)
    else if (op === 'in') parts.push(`${ident(k)} IN (${value.slice(1, -1).split(',').map(x => lit(x.replace(/^"|"$/g, ''))).join(',') || 'NULL'})`)
    else throw new Error(`filtre non simulé : ${k}=${v}`)
  }
  return parts.length ? `WHERE ${parts.join(' AND ')}` : ''
}
const cols = select => !select || select === '*' ? '*' : select.split(',').map(c => ident(c.trim())).join(', ')

function rest(req, url, body, claims) {
  const name = url.pathname.slice('/rest/v1/'.length)
  const object = String(req.headers.accept || '').includes('vnd.pgrst.object')
  if (name.startsWith('rpc/')) {
    const args = Object.entries(JSON.parse(body || '{}')).map(([k, v]) => `${ident(k)} => ${lit(v)}`).join(', ')
    return [200, sql(`SELECT to_json(public.${ident(name.slice(4))}(${args}))`, claims)]
  }
  const table = `public.${ident(name)}`
  const filter = where(url.searchParams)
  let rows
  if (req.method === 'GET' || req.method === 'HEAD') {
    const order = url.searchParams.get('order')
    const by = order ? `ORDER BY ${order.split(',').map(o => { const [c, d] = o.split('.'); return `${ident(c)} ${d === 'desc' ? 'DESC' : 'ASC'}` }).join(', ')}` : ''
    rows = sql(`SELECT coalesce(json_agg(t), '[]') FROM (SELECT ${cols(url.searchParams.get('select'))} FROM ${table} ${filter} ${by}) t`, claims)
  } else if (req.method === 'PATCH') {
    const keys = Object.keys(JSON.parse(body)).map(ident).join(', ')
    rows = sql(`WITH u AS (UPDATE ${table} SET (${keys}) = (SELECT ${keys} FROM jsonb_populate_record(NULL::${table}, ${lit(body)}::jsonb)) ${filter} RETURNING ${cols(url.searchParams.get('select'))}) SELECT coalesce(json_agg(u), '[]') FROM u`, claims)
  } else throw new Error(`méthode non simulée : ${req.method}`)
  if (!object) return [200, rows]
  const list = JSON.parse(rows)
  return list.length === 1 ? [200, JSON.stringify(list[0])] : [406, JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })]
}

const send = (res, code, body, headers = {}) => { if (process.env.E2E_TRACE) console.log(res.req.method, res.req.url.slice(0, 120), code); res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', ...headers }); res.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body)) }
const readBody = req => new Promise(r => { const d = []; req.on('data', c => d.push(c)); req.on('end', () => r(Buffer.concat(d))) })

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const path = url.pathname
  if (req.method === 'OPTIONS') return send(res, 204, '')
  const raw = await readBody(req)
  const claims = claimsOf(req)
  try {
    if (path.startsWith('/rest/v1/')) {
      try {
        const [code, body] = rest(req, url, raw.toString(), claims)
        return send(res, code, body)
      } catch (e) {
        const message = String(e.stderr || e.message)
        return send(res, 400, { code: /does not exist/.test(message) ? '42703' : /permission denied/.test(message) ? '42501' : 'ERR', message })
      }
    }

    // ── Auth ─────────────────────────────────────────────────────
    if (path === '/auth/v1/signup') {
      const b = JSON.parse(raw.toString())
      if ([...users.values()].some(u => u.email === b.email)) return send(res, 400, { msg: 'User already registered' })
      // « confirme… » : compte créé, e-mail à confirmer — pas de session tout de suite.
      const u = { id: randomUUID(), email: b.email, password: b.password, user_metadata: b.data ?? {}, confirmed: !b.email.startsWith('confirme') }
      users.set(u.id, u)
      sql(`INSERT INTO auth.users VALUES (${lit(u.id)}); INSERT INTO public.profiles (id, display_name) VALUES (${lit(u.id)}, ${lit(b.email.split('@')[0])})`, 'auth')
      return send(res, 200, u.confirmed ? session(u) : userView(u))
    }
    if (path === '/auth/v1/token') {
      const b = JSON.parse(raw.toString() || '{}')
      if (url.searchParams.get('grant_type') === 'password') {
        const u = [...users.values()].find(x => x.email === b.email && x.password === b.password)
        if (!u) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
        u.confirmed = true // l'e-mail a été confirmé « sur un autre appareil »
        return send(res, 200, session(u))
      }
      const u = users.get(String(b.refresh_token).slice(2))
      return u ? send(res, 200, session(u)) : send(res, 400, { error: 'invalid_grant' })
    }
    if (path === '/auth/v1/user') {
      const u = claims?.role === 'authenticated' ? users.get(claims.sub) : null
      if (!u) return send(res, 401, { msg: 'invalid JWT' })
      if (req.method === 'PUT') Object.assign(u.user_metadata, JSON.parse(raw.toString()).data ?? {})
      return send(res, 200, userView(u))
    }
    if (path.startsWith('/auth/v1/admin/users/')) {
      const u = users.get(path.split('/').pop())
      if (claims?.role !== 'service_role' || !u) return send(res, 404, { msg: 'not found' })
      if (req.method === 'PUT') u.user_metadata = JSON.parse(raw.toString()).user_metadata ?? u.user_metadata
      return send(res, 200, userView(u))
    }
    if (path === '/auth/v1/logout') return send(res, 204, '')

    // ── Stockage ─────────────────────────────────────────────────
    if (path.startsWith('/storage/v1/object/sign/')) {
      const key = decodeURIComponent(path.slice('/storage/v1/object/sign/'.length))
      if (req.method === 'POST') {
        const b = JSON.parse(raw.toString() || '{}')
        if (Array.isArray(b.paths)) return send(res, 200, b.paths.map(p => ({ path: p, signedURL: `/object/sign/${key}/${p}?token=x`, error: null })))
        return files.has(key) ? send(res, 200, { signedURL: `/object/sign/${key}?token=x` }) : send(res, 400, { error: 'not_found' })
      }
      return files.has(key) ? send(res, 200, files.get(key), { 'content-type': 'image/jpeg' }) : send(res, 404, { error: 'not_found' })
    }
    if (path.startsWith('/storage/v1/object/')) {
      // Comme en prod : les photos d'essai ne se lisent qu'avec la clé service.
      const key = decodeURIComponent(path.slice('/storage/v1/object/'.length))
      if (key.startsWith('trial-images') && claims?.role !== 'service_role') return send(res, 403, { error: 'forbidden' })
      if (req.method === 'POST' || req.method === 'PUT') {
        if (files.has(key) && req.headers['x-upsert'] !== 'true') return send(res, 409, { error: 'Duplicate' })
        files.set(key, raw)
        return send(res, 200, { Key: key })
      }
      if (req.method === 'GET') return files.has(key) ? send(res, 200, files.get(key), { 'content-type': 'image/jpeg' }) : send(res, 404, { error: 'not_found' })
      if (req.method === 'DELETE') {
        const removed = (JSON.parse(raw.toString() || '{}').prefixes ?? []).filter(p => files.delete(`${key}/${p}`))
        return send(res, 200, removed.map(name => ({ name })))
      }
    }

    // ── Fonction Edge trial-estimate (même protocole, sans modèle) ──
    if (path === '/functions/v1/trial-estimate') {
      if (req.headers.authorization !== `Bearer ${SERVICE}`) return send(res, 401, { error: { code: 'UNAUTHORIZED' } })
      const id = JSON.parse(raw.toString()).trial_id
      if (sql(`SELECT to_json(public.trial_begin_estimate(${lit(id)}))`) !== 'true') return send(res, 429, { error: { code: 'ATTEMPTS_EXHAUSTED' } })
      calls.estimate++
      const photo = files.get(`trial-images/${id}.jpg`)
      const estimate = photo && photo.length > 3000
        ? { value: 120, value_min: 90, value_max: 150, currency: '€', confidence: 'medium', summary: 'Lampe de bureau articulée, en bon état apparent.' }
        : null
      sql(`SELECT public.trial_save_estimate(${lit(id)}, ${lit(estimate ? 'Lampe de bureau' : null)}, ${lit(estimate ? 'Luminaire' : null)}, ${estimate ? `${lit(estimate)}::jsonb` : 'NULL'}, 'claude-haiku-4-5', 0.003)`)
      return estimate ? send(res, 200, { ok: true }) : send(res, 422, { error: { code: 'NOT_AN_OBJECT' } })
    }

    // Observation, pour le scénario : ce que le faux Supabase a en mémoire.
    if (path === '/__etat') return send(res, 200, { estimate: calls.estimate, files: [...files.keys()], users: [...users.values()].map(userView) })
    send(res, 404, { error: 'not mocked', path })
  } catch (e) {
    console.error(req.method, req.url, e)
    send(res, 500, { error: String(e.message) })
  }
}).listen(54321, () => console.log('faux supabase sur 54321'))
