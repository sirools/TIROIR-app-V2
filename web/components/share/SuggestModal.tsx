// components/share/SuggestModal.tsx — ajouter des objets à la liste d'un
// partage, sous deux formes :
//   « Depuis mon Tiroir »  choisir un ou plusieurs de ses propres objets
//   « Nouvel objet »       nom, lien optionnel, prix optionnel
//
// Selon le visiteur, la modale s'ouvre sur l'une de trois étapes :
//   signup   pas de compte Tiroir → stub de création de compte (TODO)
//   password lien protégé ouvert avec un ancien cookie non signé
//   form     le formulaire lui-même
import { useEffect, useState } from 'react'
import { INPUT_ERROR_LABEL, parseSuggestionInput, type Wish } from '../../lib/suggestions'
import SignupModalStub from './SignupModalStub'
import MyTiroirPicker from './MyTiroirPicker'

export type SuggestStep = 'signup' | 'password' | 'form'

const API_ERROR_LABEL: Record<string, string> = {
  AUTH_REQUIRED: 'Ta session a expiré : reconnecte-toi pour suggérer.',
  PASSWORD_REQUIRED: 'Saisis de nouveau le mot de passe du partage.',
  SUGGESTIONS_DISABLED: 'Le propriétaire n’accepte plus d’ajouts sur ce partage.',
  SOURCE_NOT_FOUND: 'Cet objet est introuvable dans ton Tiroir.',
  ALREADY_SUGGESTED: 'Tu as déjà proposé cet objet.',
  OWNER_CANNOT_SUGGEST: 'C’est ta collection : tu ne peux pas te suggérer d’objet.',
  TOO_MANY_PENDING: 'Tu as déjà beaucoup de suggestions en attente. Laisse le propriétaire les trier.',
  LINK_UNAVAILABLE: 'Ce lien a expiré.',
}

interface Props {
  token: string
  initialStep: SuggestStep
  onClose: () => void
  onCreated: (wish: Wish) => void
}

type Tab = 'tiroir' | 'new'

export default function SuggestModal({ token, initialStep, onClose, onCreated }: Props) {
  const [step, setStep] = useState<SuggestStep>(initialStep)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [price, setPrice] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('tiroir')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  function togglePicked(id: string) {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Envoie une suggestion ; renvoie le code d'erreur de l'API, ou null. */
  async function post(body: object): Promise<string | null> {
    const res = await fetch(`/api/shares/${encodeURIComponent(token)}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.wish) { onCreated(json.wish as Wish); return null }
    return json.error ?? 'UNKNOWN'
  }

  function handleApiError(code: string) {
    if (code === 'PASSWORD_REQUIRED') setStep('password')
    if (code === 'AUTH_REQUIRED') { setStep('signup'); return }
    setError(API_ERROR_LABEL[code] ?? 'Une erreur est survenue. Réessaie plus tard.')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (step === 'signup') return <SignupModalStub token={token} onClose={onClose} />

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(token)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) { setStep('form'); setPassword('') }
      else setError(res.status === 401 ? 'Mot de passe incorrect.' : 'Une erreur est survenue.')
    } catch {
      setError('Impossible d’atteindre le serveur.')
    } finally {
      setBusy(false)
    }
  }

  async function submitSuggestion(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseSuggestionInput({ title, url, price })
    if (!parsed.ok) { setError(INPUT_ERROR_LABEL[parsed.error]); return }

    setBusy(true); setError(null)
    try {
      const code = await post(parsed.value)
      if (code === null) { onClose(); return }
      handleApiError(code)
    } catch {
      setError('Impossible d’atteindre le serveur.')
    } finally {
      setBusy(false)
    }
  }

  /** Un objet après l'autre : chaque réussite s'affiche aussitôt dans la grille. */
  async function submitPicked() {
    if (picked.size === 0) return
    setBusy(true); setError(null)
    const failed = new Set<string>()
    let lastError: string | null = null
    try {
      for (const id of Array.from(picked)) {
        const code = await post({ sourceObjectId: id })
        if (code === null) continue
        if (code === 'PASSWORD_REQUIRED' || code === 'AUTH_REQUIRED') { handleApiError(code); return }
        failed.add(id)
        lastError = code
      }
      if (failed.size === 0) { onClose(); return }
      setPicked(failed)
      handleApiError(lastError ?? 'UNKNOWN')
    } catch {
      setError('Impossible d’atteindre le serveur.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="suggest-title" onClick={e => e.stopPropagation()}>
        <button type="button" className="close" onClick={onClose} aria-label="Fermer">×</button>
        <h2 id="suggest-title" className="heading">Ajouter à la liste</h2>

        {step === 'password' ? (
          <form onSubmit={submitPassword} className="form">
            <p className="hint">Ce partage est protégé. Confirme le mot de passe pour pouvoir suggérer.</p>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" autoFocus />
            {error && <p className="error">{error}</p>}
            <button type="submit" className="primary" disabled={busy || !password}>{busy ? '…' : 'Valider'}</button>
          </form>
        ) : (
          <>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'tiroir'} className={`tab ${tab === 'tiroir' ? 'active' : ''}`} onClick={() => { setTab('tiroir'); setError(null) }}>
              Depuis mon Tiroir
            </button>
            <button type="button" role="tab" aria-selected={tab === 'new'} className={`tab ${tab === 'new' ? 'active' : ''}`} onClick={() => { setTab('new'); setError(null) }}>
              Nouvel objet
            </button>
          </div>
          <p className="hint">Le propriétaire verra tes ajouts, avec ton prénom et ta photo, et décidera de les garder.</p>
          {tab === 'tiroir' ? (
            <div className="form">
              <MyTiroirPicker selected={picked} onToggle={togglePicked} />
              {error && <p className="error">{error}</p>}
              <button type="button" className="primary" disabled={busy || picked.size === 0} onClick={submitPicked}>
                {busy ? 'Envoi…' : picked.size > 1 ? `Proposer ces ${picked.size} objets` : 'Proposer cet objet'}
              </button>
            </div>
          ) : (
          <form onSubmit={submitSuggestion} className="form">
            <label className="label">
              Nom de l’objet
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Ex. : Couteau de chef" autoFocus required />
            </label>
            <label className="label">
              <span>Lien <span className="optional">(optionnel)</span></span>
              <input className="input" type="text" inputMode="url" autoComplete="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
            </label>
            <label className="label">
              <span>Prix <span className="optional">(optionnel)</span></span>
              <input className="input" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="Ex. : 49,90" />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="primary" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer la suggestion'}</button>
          </form>
          )}
          </>
        )}
      </div>
      <style jsx>{`
        .backdrop {
          position: fixed; inset: 0; z-index: 50;
          background: rgba(26, 22, 18, 0.45);
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .sheet {
          position: relative; width: 100%; max-width: 440px; max-height: calc(100vh - 32px); overflow-y: auto;
          background: #fff; border-radius: 20px; padding: 28px 24px 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .close {
          position: absolute; top: 10px; right: 14px;
          background: none; border: 0; font-size: 26px; color: #A89F96; cursor: pointer;
        }
        .heading { font-size: 20px; font-weight: 800; color: #1A1612; margin: 0 0 12px; }
        .tabs { display: flex; gap: 4px; padding: 4px; background: #F0EBE3; border-radius: 12px; margin-bottom: 10px; }
        .tab {
          flex: 1; padding: 8px 10px; border-radius: 9px; border: 0; background: transparent;
          font-size: 13px; font-weight: 700; color: #6B6158; cursor: pointer; font-family: inherit;
        }
        .tab.active { background: #fff; color: #1A1612; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .hint { font-size: 13px; color: #6B6158; line-height: 1.5; margin: 0 0 4px; }
        .form { display: flex; flex-direction: column; gap: 12px; }
        .label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: #1A1612; }
        .optional { font-weight: 400; color: #A89F96; }
        .input {
          padding: 12px 14px; border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.12); font-size: 15px; font-family: inherit;
        }
        .input:focus { outline: 2px solid #F26900; outline-offset: -1px; }
        .error { color: #C0392B; font-size: 13px; font-weight: 600; margin: 0; }
        .primary {
          margin-top: 4px; padding: 13px 20px; border-radius: 999px; border: 0;
          background: #F26900; color: #fff; font-weight: 700; font-size: 15px; cursor: pointer;
        }
        .primary:disabled { opacity: 0.6; cursor: default; }
      `}</style>
    </div>
  )
}
