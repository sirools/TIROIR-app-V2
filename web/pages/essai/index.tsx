// pages/essai — l'essai sans compte : une photo, l'estimation de Torix, un
// emplacement, puis « Sauvegarder dans mon Tiroir », qui mène à la création
// du compte (l'objet le suit : pages/essai/sauvegarde.tsx).
//
// Aucune session ici. L'essai tient dans un cookie illisible par la page ;
// toutes les règles (un objet, une estimation, plafonds) sont au serveur
// (pages/api/essai/, supabase/drafts/essai_sans_compte.sql).
import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'
import HeaderTiroirWeb from '../../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../../components/layout/FooterTiroirWeb'
import { localeLinks } from '../../components/layout/LocaleLinks'
import { authHref } from '../../lib/authFlow'
import { localePrefix } from '../../lib/localeRouting'
import { LOCATION_MAX, PHOTO_MAX_SIDE, SAVE_PATH, type TrialView } from '../../lib/trial'
import { fill, intlLocale, useCopy } from '../../locales'

type ErrorKey = 'invalidPhoto' | 'notObject' | 'failed' | 'noAttemptLeft' | 'ipLimit' | 'dailyCap' | 'disabled'

const ERROR_KEYS: Record<string, ErrorKey> = {
  INVALID_PHOTO: 'invalidPhoto', NOT_AN_OBJECT: 'notObject', ESTIMATE_FAILED: 'failed',
  NO_ATTEMPT_LEFT: 'noAttemptLeft', IP_LIMIT: 'ipLimit', DAILY_CAP: 'dailyCap', DISABLED: 'disabled',
}

/** Erreurs après lesquelles il ne reste qu'à créer un compte. */
const FINAL: ErrorKey[] = ['noAttemptLeft', 'ipLimit', 'dailyCap', 'disabled']

/** L'image décodée, avec sa taille. `close` libère ce qui doit l'être. */
type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

/**
 * Deux façons de lire la photo. createImageBitmap d'abord ; sinon une
 * balise <img>, que tous les navigateurs savent remplir — les Safari
 * d'avant iOS 17 refusent l'option d'orientation de createImageBitmap, et
 * une photo HEIC ne se lit que par <img>. Les deux respectent le sens de
 * prise de vue (EXIF).
 */
async function decode(file: File): Promise<Decoded | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  } catch {
    /* seconde méthode ci-dessous */
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img.naturalWidth > 0
      ? { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
      : (URL.revokeObjectURL(url), null)
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}

/**
 * Réduit la photo dans le navigateur et la réencode en JPEG : l'envoi est
 * léger (le visiteur est peut-être en 4G), l'analyse coûte moins, et les
 * données de prise de vue (lieu, appareil) ne quittent pas le téléphone.
 */
async function toJpegDataUrl(file: File): Promise<string | null> {
  const image = await decode(file)
  if (!image) return null
  try {
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return null
    // Fond blanc : un PNG transparent deviendrait noir en JPEG.
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height)
    const url = canvas.toDataURL('image/jpeg', 0.82)
    return url.startsWith('data:image/jpeg') ? url : null
  } catch {
    return null
  } finally {
    image.close()
  }
}

export default function Essai() {
  const { t: { trial: t }, locale } = useCopy()
  const prefix = localePrefix(locale)
  const cameraInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [trial, setTrial] = useState<TrialView | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ErrorKey | null>(null)
  const [location, setLocation] = useState('')
  const [leaving, setLeaving] = useState(false)

  // Reprendre un essai en cours (retour sur la page, rechargement).
  useEffect(() => {
    fetch('/api/essai')
      .then(r => (r.ok ? r.json() : { trial: null }))
      .then((d: { trial: TrialView | null }) => {
        if (d.trial && d.trial.status !== 'claimed') {
          setTrial(d.trial)
          setLocation(d.trial.location ?? '')
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  async function onPhoto(file: File | undefined) {
    if (!file || busy) return
    setError(null)
    const photo = await toJpegDataUrl(file)
    if (!photo) {
      setError('invalidPhoto')
      return
    }
    setPreview(photo)
    setBusy(true)
    try {
      const res = await fetch('/api/essai/estimer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo, locale }),
      })
      const data = (await res.json().catch(() => ({}))) as { trial?: TrialView; error?: string; canRetry?: boolean }
      if (res.ok && data.trial) {
        setTrial(data.trial)
        setLocation(data.trial.location ?? '')
        return
      }
      if (data.error === 'ALREADY_ESTIMATED') {
        // Un essai existe déjà dans ce navigateur : on le montre.
        const current = (await fetch('/api/essai').then(r => r.json()).catch(() => ({ trial: null }))) as { trial: TrialView | null }
        if (current.trial && current.trial.status === 'estimated') {
          setTrial(current.trial)
          setLocation(current.trial.location ?? '')
          return
        }
      }
      const key = ERROR_KEYS[data.error ?? ''] ?? 'failed'
      // Dernière tentative consommée : inutile de proposer une autre photo.
      setError(data.canRetry === false && !FINAL.includes(key) ? 'noAttemptLeft' : key)
      setPreview(null)
    } catch {
      setError('failed')
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  /** L'emplacement part avec le clic : rien à « enregistrer » à part. */
  async function leave(page: '/login' | '/inscription') {
    if (leaving) return
    setLeaving(true)
    try {
      await fetch('/api/essai/emplacement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location }),
      })
    } catch {
      /* l'emplacement se complétera dans la fiche */
    }
    window.location.assign(prefix + authHref(page, SAVE_PATH))
  }

  const money = (n: number) =>
    n.toLocaleString(intlLocale(locale), { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 })
  const estimate = trial?.status === 'estimated' ? trial.estimate : null
  const final = error !== null && FINAL.includes(error)

  return (
    <>
      <Head>
        <title>{t.metaTitle}</title>
        <meta name="description" content={t.metaDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {localeLinks(locale, '/essai')}
      </Head>
      <div className="root">
        <HeaderTiroirWeb />
        <main className="main">
          {!estimate ? (
            <>
              <h1>{t.title}</h1>
              <p className="intro">{t.intro}</p>

              <div className="card">
                {busy ? (
                  <div className="analysing" role="status" aria-live="polite">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {preview && <img className="photo" src={preview} alt={t.photoAlt} />}
                    <p className="torix"><span aria-hidden="true">✦ </span>{t.analysing}</p>
                    <p className="hint">{t.analysingHint}</p>
                  </div>
                ) : (
                  <>
                    <div role="alert">{error && <p className="error">{t.errors[error]}</p>}</div>
                    {final ? (
                      <a className="primary" href={prefix + authHref('/inscription', null)}>{t.createAccount}</a>
                    ) : (
                      <>
                        <input
                          ref={cameraInput} type="file" accept="image/*" capture="environment" hidden
                          onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = '' }}
                        />
                        <input
                          ref={fileInput} type="file" accept="image/*" hidden
                          onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = '' }}
                        />
                        <button type="button" className="primary" disabled={!loaded} onClick={() => cameraInput.current?.click()}>
                          {t.takePhoto}
                        </button>
                        <button type="button" className="secondary" disabled={!loaded} onClick={() => fileInput.current?.click()}>
                          {t.importPhoto}
                        </button>
                        <p className="hint">{t.photoHint}</p>
                      </>
                    )}
                  </>
                )}
              </div>
              <p className="legal">
                {t.retentionBefore}{' '}
                <a href={`${prefix}/privacy`}>{t.privacyLink}</a>
              </p>
            </>
          ) : (
            <>
              <div className="card result">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {(trial?.photoUrl || preview) && <img className="photo" src={trial?.photoUrl ?? preview ?? ''} alt={t.photoAlt} />}
                <h1 className="object-title">{trial?.title}</h1>
                {trial?.category && <p className="category">{trial.category}</p>}

                {/* Comme dans la fiche objet : l'estimation de Torix d'abord, le prix ensuite. */}
                <div className="estimate">
                  <p className="torix"><span aria-hidden="true">✦ </span>{t.estimateLabel}</p>
                  {estimate.summary && <p className="summary">{estimate.summary}</p>}
                  <p className="price">{money(estimate.value)}</p>
                  {estimate.max > estimate.min && (
                    <p className="range">{fill(t.range, { min: money(estimate.min), max: money(estimate.max) })}</p>
                  )}
                  <p className="confidence">{t.confidence[estimate.confidence]}</p>
                  <p className="note">{t.estimateNote}</p>
                </div>

                <label className="label" htmlFor="trial-location">{t.locationLabel}</label>
                <input
                  id="trial-location" className="input" type="text" value={location} maxLength={LOCATION_MAX}
                  placeholder={t.locationPlaceholder} autoComplete="off"
                  onChange={e => setLocation(e.target.value)}
                />
                <p className="hint left">{t.locationHint}</p>

                <button type="button" className="primary" disabled={leaving} onClick={() => leave('/inscription')}>
                  {leaving ? t.saving : t.save}
                </button>
                <p className="hint">{t.saveHint}</p>
                <button type="button" className="link" disabled={leaving} onClick={() => leave('/login')}>{t.haveAccount}</button>
              </div>
              <p className="legal">
                {fill(t.retention, {
                  date: new Date(trial!.expiresAt).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long' }),
                })}{' '}
                {t.oneObject}{' '}
                <a href={`${prefix}/privacy`}>{t.privacyLink}</a>
              </p>
            </>
          )}
        </main>
        <FooterTiroirWeb />
      </div>
      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 520px; margin: 0 auto; padding: 40px 16px 64px; }
        h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.15; margin: 0 0 10px; text-wrap: balance; }
        .intro { font-size: 16px; line-height: 1.5; color: var(--muted); margin: 0 0 24px; }
        .card { display: flex; flex-direction: column; gap: 10px; padding: 20px; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); box-shadow: var(--shadow); }
        .primary { display: flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 20px; border-radius: 12px; border: 0; background: var(--orange); color: var(--white); font: inherit; font-size: 16px; font-weight: 700; text-decoration: none; cursor: pointer; }
        .primary:hover:not(:disabled) { background: var(--orange-700); }
        .secondary { min-height: 48px; padding: 0 20px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
        .link { min-height: 44px; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--orange-700); cursor: pointer; }
        button:disabled { opacity: 0.55; cursor: default; }
        a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        .hint { margin: 0; font-size: 13px; line-height: 1.45; color: var(--muted); text-align: center; }
        .hint.left { text-align: left; }
        .error { margin: 0 0 4px; padding: 10px 14px; border-radius: 10px; background: var(--error-light); color: var(--error); font-size: 14px; line-height: 1.45; }
        .analysing { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 8px 0; }
        .photo { display: block; width: 100%; max-height: 360px; object-fit: contain; border-radius: 12px; background: var(--surface-subtle); }
        .torix { margin: 0; font-size: 14px; font-weight: 700; color: var(--orange-700); }
        .analysing .torix { animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 50% { opacity: 0.45; } }
        @media (prefers-reduced-motion: reduce) { .analysing .torix { animation: none; } }
        .object-title { font-size: 24px; margin: 8px 0 0; overflow-wrap: anywhere; }
        .category { margin: 0; font-size: 14px; color: var(--muted); }
        .estimate { margin: 6px 0 10px; padding: 16px; border-radius: 14px; background: var(--beige); }
        .summary { margin: 6px 0 12px; font-size: 14px; line-height: 1.5; }
        .price { margin: 0; font-size: 36px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .range { margin: 4px 0 0; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .confidence { margin: 8px 0 0; font-size: 13px; font-weight: 600; color: var(--muted); }
        .note { margin: 8px 0 0; font-size: 12px; line-height: 1.45; color: var(--muted); }
        .label { font-size: 15px; font-weight: 700; margin-top: 4px; }
        .input { width: 100%; min-height: 48px; padding: 0 14px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 16px; }
        .result .primary { margin-top: 10px; }
        .legal { margin: 16px 4px 0; font-size: 12px; line-height: 1.5; color: var(--muted); }
        .legal a { color: inherit; }
      `}</style>
    </>
  )
}
