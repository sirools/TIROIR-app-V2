import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/')
  }

  return (
    <main style={s.root}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.logoBox}>T</div>
          <strong style={s.logoText}>Tiroir</strong>
        </div>
        <h1 style={s.title}>Connexion</h1>

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            style={s.input}
            placeholder="exemple@gmail.com"
          />

          <label style={s.label}>Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={s.input}
            placeholder="••••••••"
          />

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF4E6', padding: 24 },
  card:     { width: '100%', maxWidth: 400, background: 'white', borderRadius: 20, padding: '40px 32px', boxShadow: '0 6px 24px rgba(0,0,0,0.08)' },
  logo:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoBox:  { width: 36, height: 36, borderRadius: 10, background: '#F26900', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 },
  logoText: { fontSize: 20, fontWeight: 800, color: '#121212' },
  title:    { fontSize: 20, fontWeight: 700, color: '#121212', marginBottom: 24 },
  form:     { display: 'flex', flexDirection: 'column', gap: 8 },
  label:    { fontSize: 13, fontWeight: 600, color: '#555', marginTop: 8 },
  input:    { padding: '10px 14px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, outline: 'none', transition: 'border-color 0.15s' },
  error:    { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 8, padding: '8px 12px', marginTop: 4 },
  btn:      { marginTop: 12, padding: '13px 0', borderRadius: 12, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', textAlign: 'center' },
}
