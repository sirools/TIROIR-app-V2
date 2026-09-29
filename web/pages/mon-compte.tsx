// Gestion du compte : changement de mot de passe en direct, ou envoi d'un
// lien de réinitialisation par e-mail.
//
// Les comptes créés via Google n'ont pas de mot de passe : on le détecte via
// les identités de l'utilisateur et on adapte le libellé (« définir » plutôt
// que « changer »), sans jamais bloquer l'action — poser un mot de passe sur
// un compte OAuth est justement ce qui permet ensuite les deux méthodes.
import Head from 'next/head'
import { useEffect, useState } from 'react'
import type { GetServerSideProps } from 'next'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import { supabase, serverSupabase } from '../lib/supabase'
import { linkErrorMessage, providerRows, type IdentityLike, type Provider } from '../lib/identities'

const MIN_PASSWORD_LENGTH = 8

export default function MonCompte() {
  const [email, setEmail] = useState('')
  const [providers, setProviders] = useState<string[]>([])

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [passwordDone, setPasswordDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const [identities, setIdentities] = useState<IdentityLike[]>([])
  const [linkBusy, setLinkBusy] = useState<Provider | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkDone, setLinkDone] = useState<string | null>(null)

  async function refreshIdentities() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    setEmail(data.user.email ?? '')
    const ids = (data.user.identities ?? []) as IdentityLike[]
    setIdentities(ids)
    setProviders(ids.map(i => i.provider))
  }

  useEffect(() => {
    refreshIdentities()
    // Retour d'une liaison (Google renvoie ici après accord).
    if (new URLSearchParams(window.location.search).has('lie')) setLinkDone('Moyen de connexion ajouté à ton compte.')
  }, [])

  async function handleLink(provider: Provider) {
    if (provider === 'email') return
    setLinkError(null); setLinkDone(null); setLinkBusy(provider)
    const { error: linkErr } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/mon-compte?lie=1` },
    })
    // En cas de succès, le navigateur part chez le fournisseur : on ne revient ici qu'en cas d'erreur.
    if (linkErr) { setLinkError(linkErrorMessage(linkErr.message)); setLinkBusy(null) }
  }

  async function handleUnlink(provider: Provider) {
    setLinkError(null); setLinkDone(null); setLinkBusy(provider)
    const { data } = await supabase.auth.getUserIdentities()
    const identity = data?.identities.find(i => i.provider === provider)
    if (!identity) { setLinkBusy(null); return }
    const { error: unlinkErr } = await supabase.auth.unlinkIdentity(identity)
    setLinkBusy(null)
    if (unlinkErr) { setLinkError(linkErrorMessage(unlinkErr.message)); return }
    setLinkDone('Moyen de connexion retiré.')
    refreshIdentities()
  }

  const hasPassword = providers.includes('email')
  const oauthOnly = providers.length > 0 && !hasPassword

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPasswordDone(false)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`)
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) { setError(updateError.message); return }

    setPassword('')
    setConfirm('')
    setPasswordDone(true)
    // L'identité e-mail vient d'être créée sur un compte OAuth : on rafraîchit
    // pour que le libellé passe de « définir » à « changer ».
    supabase.auth.getUser().then(({ data }) => {
      setProviders((data.user?.identities ?? []).map(i => i.provider))
    })
  }

  async function handleSendReset() {
    setResetLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
    })
    setResetLoading(false)
    if (resetError) { setError(resetError.message); return }
    setResetSent(true)
  }

  return (
    <>
      <Head><title>Mon compte — Tiroir</title></Head>
      <HeaderTiroirWeb />

      <main className="section">
        <div className="container" style={{ maxWidth: 640 }}>
          <h1 className="h2" style={{ marginBottom: 8 }}>Mon compte</h1>
          <p className="p" style={{ marginBottom: 32 }}>
            Connecté avec <strong>{email || '…'}</strong>
            {oauthOnly && ' — sans mot de passe.'}
          </p>

          {/* ── Moyens de connexion ── */}
          <div className="card" style={s.card}>
            <h2 style={s.cardTitle}>Moyens de connexion</h2>
            <p style={s.cardText}>
              Un seul compte Tiroir, sur le site comme dans l’application, quel que soit le moyen
              de connexion. Relie-les ici pour retrouver partout les mêmes objets.
            </p>
            <ul style={s.rows}>
              {providerRows(identities).map(row => (
                <li key={row.provider} style={s.row}>
                  <span style={{ flex: 1 }}>
                    <strong style={{ color: '#121212' }}>{row.label}</strong>
                    <span style={s.rowState}>
                      {row.linked ? ` — relié${row.email && row.email !== email ? ` (${row.email})` : ''}` : ' — non relié'}
                    </span>
                  </span>
                  {row.action === 'link' && (
                    <button type="button" style={s.btnSmall} disabled={linkBusy !== null} onClick={() => handleLink(row.provider)}>
                      {linkBusy === row.provider ? '…' : 'Relier'}
                    </button>
                  )}
                  {row.action === 'unlink' && (
                    <button type="button" style={s.btnSmallGhost} disabled={linkBusy !== null} onClick={() => handleUnlink(row.provider)}>
                      {linkBusy === row.provider ? '…' : 'Retirer'}
                    </button>
                  )}
                  {row.action === 'set-password' && (
                    <a href="#mot-de-passe" style={s.link}>Définir</a>
                  )}
                  {row.action === 'app-only' && (
                    <span style={s.rowHint}>se relie depuis l’app</span>
                  )}
                </li>
              ))}
            </ul>
            {linkError && <p style={s.error}>{linkError}</p>}
            {linkDone && <p style={s.success}>✓ {linkDone}</p>}
          </div>

          {/* ── Mot de passe ── */}
          <div id="mot-de-passe" className="card" style={s.card}>
            <h2 style={s.cardTitle}>
              {oauthOnly ? 'Définir un mot de passe' : 'Changer le mot de passe'}
            </h2>
            <p style={s.cardText}>
              {oauthOnly
                ? "Ton compte n'a pas encore de mot de passe. Définis-en un pour pouvoir aussi te connecter par e-mail — tous tes moyens de connexion fonctionneront ensuite."
                : 'Choisis un nouveau mot de passe. Il sera valable sur le site comme dans l’application mobile.'}
            </p>

            <form onSubmit={handleChangePassword} style={s.form}>
              <label style={s.label}>Nouveau mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={s.input}
                placeholder="8 caractères minimum"
              />
              <label style={s.label}>Confirmer</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                style={s.input}
                placeholder="••••••••"
              />
              {error && <p style={s.error}>{error}</p>}
              {passwordDone && <p style={s.success}>✓ Mot de passe enregistré.</p>}
              <button type="submit" disabled={saving} style={s.btn}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </form>
          </div>

          {/* ── Reset par e-mail ── */}
          <div className="card" style={s.card}>
            <h2 style={s.cardTitle}>Recevoir un lien par e-mail</h2>
            <p style={s.cardText}>
              Tu préfères passer par ta boîte mail ? On t’envoie un lien de réinitialisation
              à <strong>{email || '…'}</strong>. Il est valable une heure et ne sert qu’une fois.
            </p>
            {resetSent ? (
              <p style={s.success}>✓ E-mail envoyé. Vérifie ta boîte de réception.</p>
            ) : (
              <button
                type="button"
                onClick={handleSendReset}
                disabled={resetLoading || !email}
                style={s.btnSecondary}
              >
                {resetLoading ? 'Envoi…' : 'M’envoyer un lien'}
              </button>
            )}
          </div>

          <p style={s.footnote}>
            Pour modifier ton nom d’affichage, rends-toi sur <a href="/profil" style={s.link}>Mon profil</a>.
          </p>
        </div>
      </main>

      <FooterTiroirWeb />
    </>
  )
}

// Page réservée aux comptes connectés.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabaseServer = serverSupabase(ctx)
  const { data: { session } } = await supabaseServer.auth.getSession()
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } }
  }
  return { props: {} }
}

const s: Record<string, React.CSSProperties> = {
  card:         { padding: 24, marginBottom: 20 },
  cardTitle:    { fontSize: 17, fontWeight: 700, color: '#121212', marginBottom: 8 },
  cardText:     { fontSize: 14, color: '#5b5b5b', lineHeight: 1.6, marginBottom: 16 },
  form:         { display: 'flex', flexDirection: 'column', gap: 8 },
  label:        { fontSize: 13, fontWeight: 600, color: '#555', marginTop: 8 },
  input:        { padding: '10px 14px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, outline: 'none' },
  error:        { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 8, padding: '8px 12px', marginTop: 4 },
  success:      { fontSize: 13, color: '#2e7d32', fontWeight: 600, marginTop: 4 },
  btn:          { marginTop: 12, padding: '13px 0', borderRadius: 12, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', textAlign: 'center' },
  btnSecondary: { padding: '12px 20px', borderRadius: 12, background: 'white', color: '#121212', fontWeight: 700, fontSize: 15, border: '1.5px solid rgba(0,0,0,0.15)', cursor: 'pointer' },
  footnote:     { fontSize: 13, color: '#999', marginTop: 8 },
  link:         { color: '#F26900', fontWeight: 600, textDecoration: 'none' },
  rows:         { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  row:          { display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.06)' },
  rowState:     { color: '#5b5b5b' },
  rowHint:      { fontSize: 12, color: '#999' },
  btnSmall:     { padding: '8px 14px', borderRadius: 10, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' },
  btnSmallGhost:{ padding: '8px 14px', borderRadius: 10, background: 'white', color: '#121212', fontWeight: 700, fontSize: 13, border: '1.5px solid rgba(0,0,0,0.15)', cursor: 'pointer' },
}
