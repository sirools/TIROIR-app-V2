import { describe, expect, test } from 'vitest'
import handler from '../pages/api/health'

function fakeRes() {
  const res: any = { headers: {} as Record<string, string>, statusCode: 0, body: null }
  res.setHeader = (k: string, v: string) => { res.headers[k] = v }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: unknown) => { res.body = b; return res }
  return res
}

describe('/api/health', () => {
  test('sans base joignable : 503, site ok, base ko, jamais en cache', async () => {
    const saved = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const res = fakeRes()
    await handler({} as any, res)
    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({ status: 'degraded', site: 'ok', db: 'ko' })
    expect(res.headers['Cache-Control']).toBe('no-store')
    if (saved !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved
  })
})
