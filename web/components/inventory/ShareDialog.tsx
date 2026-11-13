// « Partager » depuis l'inventaire : crée un lien de partage pour les
// objets cochés, par la même Edge Function que l'app (create-share-link),
// avec la session du propriétaire. Le lien est en lecture seule, sans mot
// de passe ni expiration ; ils se règlent ensuite dans « Mes partages ».
//
// L'app partage par défaut l'emplacement et l'assurance, qu'on peut y
// décocher. Ici il n'y a pas ces cases : ils ne sont donc pas partagés.
import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { fill, useCopy } from '../../locales'

type Props = { objectIds: string[]; defaultTitle: string; onClose: () => void }

const FIELDS = { values: true, attributes: true, description: true, location: false, insurance: false }

export default function ShareDialog({ objectIds, defaultTitle, onClose }: Props) {
  const { t: { inventory: { share: t } }, locale } = useCopy()
  const [title, setTitle] = useState(defaultTitle)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function create(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setFailed(false)
    const { data, error } = await supabase.functions.invoke('create-share-link', {
      body: {
        object_ids: objectIds,
        title: title.trim() || defaultTitle,
        options: { password_protected: false, allow_download: false, include_documents: false, fields: FIELDS },
        contact: {},
        lang: locale,
      },
    })
    setBusy(false)
    const token = (data as { token?: string } | null)?.token
    if (error || !token) {
      setFailed(true)
      return
    }
    // Sur ce site, pas sur l'adresse renvoyée : un aperçu ouvre son propre lien.
    setUrl(`${window.location.origin}/s/${token}`)
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* le lien reste affiché, à copier à la main */ }
  }

  const heading = fill(objectIds.length === 1 ? t.titleOne : t.titleOther, { n: objectIds.length })

  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
        <h2 id="share-dialog-title">{heading}</h2>
        {url ? (
          <>
            <p className="ok" role="status">{t.ready}</p>
            <input className="field" type="text" readOnly value={url} onFocus={e => e.currentTarget.select()} aria-label={t.copy} />
            <div className="actions">
              <button type="button" className="primary" onClick={copy}>{copied ? t.copied : t.copy}</button>
              <Link href="/mes-partages" legacyBehavior passHref><a className="link">{t.manage}</a></Link>
              <button type="button" className="text" onClick={onClose}>{t.close}</button>
            </div>
          </>
        ) : (
          <form onSubmit={create}>
            <label htmlFor="share-dialog-name">{t.nameLabel}</label>
            <input
              id="share-dialog-name" ref={input} className="field" type="text" maxLength={120}
              value={title} onChange={e => setTitle(e.target.value)}
            />
            <p className="hint">{t.hint}</p>
            <div role="status" aria-live="polite">{failed && <p className="alert">{t.failed}</p>}</div>
            <div className="actions">
              <button type="submit" className="primary" disabled={busy}>{busy ? t.creating : t.create}</button>
              <button type="button" className="text" onClick={onClose}>{t.close}</button>
            </div>
          </form>
        )}
      </div>
      <style jsx>{`
        * { box-sizing: border-box; }
        .overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, 0.4); font-family: var(--font-body); color: var(--ink); }
        .dialog { width: 100%; max-width: 460px; background: var(--white); border-radius: 24px; padding: 24px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); }
        h2 { font-size: 20px; line-height: 1.25; margin: 0 0 16px; }
        label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
        .field { width: 100%; min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 16px; }
        .hint { margin: 10px 0 0; font-size: 13px; line-height: 1.45; color: var(--muted); }
        .ok { margin: 0 0 10px; font-size: 14px; font-weight: 700; }
        .alert { margin: 12px 0 0; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--orange); font-size: 14px; }
        .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 18px; }
        .primary { min-height: 44px; padding: 0 18px; border-radius: 10px; border: 0; background: var(--orange); color: var(--white); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
        .text { min-height: 44px; padding: 0 4px; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; margin-left: auto; }
        .link { font-size: 14px; font-weight: 600; color: var(--orange-700); }
        button:disabled { opacity: 0.5; cursor: default; }
        input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
      `}</style>
    </div>
  )
}
