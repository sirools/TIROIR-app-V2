import { useState } from 'react'
import { useRouter } from 'next/router'

type Props = {
  endpoint?: string            // ex: "/api/waitlist" (défaut)
  redirectOnSuccess?: boolean  // si true -> redirection /merci
}

export default function BetaSignupForm({
  endpoint = '/api/waitlist',
  redirectOnSuccess = false,
}: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [ok, setOk] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setOk(null)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          marketingConsent: true,
          website: '', // honeypot: laisser vide
        }),
      })
      if (res.ok) {
        setOk(true)
        setEmail('')
        if (redirectOnSuccess) {
          router.push('/merci')
          return
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Erreur')
        setOk(false)
      }
    } catch {
      setError('Impossible de contacter le serveur.')
      setOk(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="signup" style={{ display: 'flex', gap: 8 }}>
      {/* Honeypot invisible */}
      <input
        type="text"
        name="website"
        autoComplete="off"
        tabIndex={-1}
        style={{ display: 'none' }}
        onChange={() => {}}
      />

      <input
        type="email"
        required
        placeholder="ton@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)' }}
      />
      <button className="btn btn-primary" disabled={loading || !email} type="submit">
        {loading ? '...' : 'Je veux la beta'}
      </button>

      {!redirectOnSuccess && ok && <p style={{ color: 'green' }}>Merci ! On te prévient vite 🎉</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </form>
  )
}