// « Contacter le vendeur », près du prix d'une vente (/ventes/<jeton>).
// Connecté : un champ message (et le choix d'un pseudo, la première fois).
// Sans compte : pseudo, e-mail, message — le message part quand le
// visiteur ouvre le lien reçu par e-mail. L'envoi passe par
// /api/messages/contact ; le texte est chiffré côté serveur.
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { BODY_MAX, PSEUDO_MAX } from '../../lib/messaging'
import { fill, useCopy } from '../../locales'

type Props = {
  token: string
  /** Pseudo du vendeur (ou prénom de son profil s'il n'en a pas). */
  sellerName: string
  loggedIn: boolean
  /** Compte connecté sans pseudo : il en choisit un avant son premier message. */
  needsPseudo?: boolean
}

export default function ContactSeller({ token, sellerName, loggedIn, needsPseudo = false }: Props) {
  const { t: { messages: { contact: t } }, locale } = useCopy()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ pending: boolean; threadId: string | null } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/messages/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, body, website, locale, ...(loggedIn ? (needsPseudo ? { pseudo: name } : {}) : { name, email }) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setDone({ pending: !!data.pending, threadId: typeof data.threadId === 'string' ? data.threadId : null })
        setBody('')
      } else setError((t.errors as Record<string, string>)[String(data.error ?? '')] ?? t.errors.generic)
    } catch {
      setError(t.errors.generic)
    }
    setBusy(false)
  }

  return (
    <div className="contact">
      {done ? (
        <div role="status" aria-live="polite">
          <p className="done">{done.pending ? t.checkEmail : t.sent}</p>
          {done.threadId && <Link href={`/messages/${done.threadId}`} legacyBehavior passHref><a className="link">{t.openThread}</a></Link>}
        </div>
      ) : !open ? (
        <button type="button" className="cta" onClick={() => setOpen(true)}>{t.button}</button>
      ) : (
        <form onSubmit={submit} noValidate>
          <h2>{fill(t.title, { name: sellerName })}</h2>
          <p className="hint">{fill(t.private, { name: sellerName })}</p>
          {(!loggedIn || needsPseudo) && (
            <>
              <label htmlFor="contact-name">{t.name}</label>
              <input
                id="contact-name" type="text" autoComplete="nickname" autoCapitalize="none" spellCheck={false}
                maxLength={PSEUDO_MAX} value={name} onChange={e => setName(e.target.value)} required aria-describedby="contact-name-hint"
              />
              <p className="hint" id="contact-name-hint">{fill(loggedIn ? t.pseudoMember : t.pseudoHint, { name: sellerName })}</p>
            </>
          )}
          {!loggedIn && (
            <>
              <label htmlFor="contact-email">{t.email}</label>
              <input id="contact-email" type="email" autoComplete="email" inputMode="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} required aria-describedby="contact-email-hint" />
              <p className="hint" id="contact-email-hint">{fill(t.emailHint, { name: sellerName })}</p>
              {/* Piège à robots : invisible et hors tabulation pour un humain. */}
              <div className="trap" aria-hidden="true">
                <label htmlFor="contact-website">Website</label>
                <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
              </div>
            </>
          )}
          <label htmlFor="contact-body">{t.message}</label>
          <textarea id="contact-body" rows={4} maxLength={BODY_MAX} value={body} placeholder={t.placeholder} onChange={e => setBody(e.target.value)} required autoFocus={loggedIn && !needsPseudo} />
          <div role="status" aria-live="polite">{error && <p className="alert">{error}</p>}</div>
          <div className="actions">
            <button type="submit" className="cta" disabled={busy || !body.trim() || ((!loggedIn || needsPseudo) && !name.trim()) || (!loggedIn && !email.trim())}>{busy ? t.sending : t.send}</button>
            <button type="button" className="text-btn" onClick={() => setOpen(false)}>{t.cancel}</button>
          </div>
        </form>
      )}
      <style jsx>{`
        .contact { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-light); }
        h2 { font-size: 15px; font-weight: 700; margin: 0 0 4px; }
        label { display: block; font-size: 13px; font-weight: 700; margin: 12px 0 6px; }
        input, textarea { width: 100%; min-width: 0; min-height: 46px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 16px; }
        textarea { resize: vertical; line-height: 1.4; }
        .hint { margin: 6px 0 0; font-size: 13px; line-height: 1.45; color: var(--muted); }
        .trap { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
        .cta { width: 100%; min-height: 46px; padding: 0 20px; border-radius: 10px; border: 1.5px solid var(--orange); background: var(--white); color: var(--orange-700); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
        form .cta { width: auto; background: var(--orange); color: var(--white); }
        .actions { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
        .text-btn { min-height: 44px; padding: 0 4px; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--muted); text-decoration: underline; cursor: pointer; }
        .alert { margin: 10px 0 0; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--orange); font-size: 14px; }
        .done { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.45; }
        .link { display: inline-block; margin-top: 8px; font-size: 14px; font-weight: 700; color: var(--orange-700); }
        button:disabled { opacity: 0.5; cursor: default; }
        input:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
      `}</style>
    </div>
  )
}
