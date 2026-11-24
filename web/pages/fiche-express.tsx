// pages/fiche-express.tsx — « Fiche express » : la brique d'IA hybride.
// Une photo → l'appareil propose la fiche tout de suite (même hors ligne),
// puis le cloud l'enrichit. Chaque information porte son badge, « Sur
// l'appareil » ou « Cloud ». Toute l'IA passe par Firebase AI Logic
// (lib/hybridAI) ; la page ne décide jamais où part une demande.
//
// La page n'existe que dans le build hackathon (NEXT_PUBLIC_HACKATHON_BUILD).
// Elle ne dépend pas de Supabase : Firebase suffit pour la lancer.
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HACKATHON_BUILD, NoAiReachableError, hybridAI, isFirebaseConfigured,
  type AiSource, type OnDeviceStatus, type Photo,
} from '../lib/hybridAI'
import { loadDrafts, nextStep, saveDrafts, upsertDraft, type Draft } from '../lib/hybridAI/drafts'
import { fill, formatEur, useCopy } from '../locales'

export async function getServerSideProps() {
  return HACKATHON_BUILD ? { props: {} } : { notFound: true as const }
}

/** Côté le plus long de la photo envoyée au modèle. */
const MAX_SIDE = 1024

/** Réduit la photo et la passe en JPEG : c'est ce que le modèle embarqué accepte. */
async function toPhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return { base64: canvas.toDataURL('image/jpeg', 0.82).split(',')[1], mimeType: 'image/jpeg' }
}

type Phase = 'running' | 'waiting' | 'failed'

/** Badge de provenance : « Sur l'appareil » ou « Cloud ». */
function SourceBadge({ source, label }: { source: AiSource; label: string }) {
  return (
    <span className={`source ${source}`}>
      {label}
      <style jsx>{`
        .source { font-size: 11px; font-weight: 700; line-height: 1.4; padding: 2px 8px; border-radius: 999px; white-space: nowrap; animation: pop 0.35s ease-out; }
        .on_device { background: var(--surface-subtle); color: var(--success); border: 1px solid var(--sage); }
        .cloud { background: var(--beige); color: var(--orange-700); border: 1px solid var(--orange); }
        @keyframes pop { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .source { animation: none; } }
      `}</style>
    </span>
  )
}

export default function FicheExpressPage() {
  const { t: { express: t }, locale } = useCopy()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [device, setDevice] = useState<OnDeviceStatus | null>(null)
  const [download, setDownload] = useState<number | null>(null)
  const [phases, setPhases] = useState<Record<string, Phase>>({})
  const [photoError, setPhotoError] = useState(false)
  const draftsRef = useRef<Draft[]>([])
  const busy = useRef(new Set<string>())
  const configured = isFirebaseConfigured()

  const store = useCallback((next: Draft[]) => {
    const kept = saveDrafts(window.localStorage, next)
    draftsRef.current = kept
    setDrafts(kept)
  }, [])
  const setPhase = (id: string, phase: Phase | null) =>
    setPhases(p => {
      const { [id]: _, ...rest } = p
      return phase ? { ...rest, [id]: phase } : rest
    })

  // Avance un brouillon d'autant d'étapes que possible : fiche rapide,
  // puis enrichissement. Sans réseau, il attend ; il reprendra tout seul.
  const advance = useCallback(async (id: string, isOnline: boolean) => {
    if (busy.current.has(id)) return
    busy.current.add(id)
    try {
      for (;;) {
        const draft = draftsRef.current.find(d => d.id === id)
        const step = draft ? nextStep(draft) : 'done'
        if (!draft || step === 'done') return setPhase(id, null)
        if (step === 'enrich' && !isOnline) return setPhase(id, 'waiting')
        setPhase(id, 'running')
        const options = { locale, online: isOnline }
        const updated: Draft = step === 'quick'
          ? { ...draft, quick: await hybridAI.quickCard(draft.photo, options) }
          : { ...draft, enrichment: await hybridAI.enrich(draft.photo, draft.quick!.data, options) }
        // Le brouillon a pu être supprimé pendant l'appel.
        if (!draftsRef.current.some(d => d.id === id)) return
        store(upsertDraft(draftsRef.current, updated))
      }
    } catch (error) {
      if (!(error instanceof NoAiReachableError)) console.error('[fiche-express]', error)
      setPhase(id, error instanceof NoAiReachableError ? 'waiting' : 'failed')
    } finally {
      busy.current.delete(id)
    }
  }, [locale, store])

  const refreshDevice = useCallback(() => {
    hybridAI.onDeviceStatus(locale).then(setDevice)
  }, [locale])

  // Au chargement : brouillons de l'appareil, état du réseau, IA embarquée.
  useEffect(() => {
    const saved = loadDrafts(window.localStorage)
    draftsRef.current = saved
    setDrafts(saved)
    setCurrentId(saved[0]?.id ?? null)
    setOnline(navigator.onLine)
    refreshDevice()
  }, [refreshDevice])

  // Le réseau revient : les brouillons en attente reprennent seuls.
  useEffect(() => {
    if (!configured) return
    const resume = (isOnline: boolean) => {
      setOnline(isOnline)
      for (const d of draftsRef.current) if (nextStep(d) !== 'done') void advance(d.id, isOnline)
    }
    const up = () => resume(true)
    const down = () => resume(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    resume(navigator.onLine)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [advance, configured])

  async function onPick(file: File | undefined) {
    if (!file) return
    setPhotoError(false)
    let photo: Photo
    try {
      photo = await toPhoto(file)
    } catch {
      return setPhotoError(true)
    }
    const draft: Draft = { id: crypto.randomUUID(), createdAt: Date.now(), photo, quick: null, enrichment: null }
    store(upsertDraft(draftsRef.current, draft))
    setCurrentId(draft.id)
    void advance(draft.id, navigator.onLine)
  }

  async function downloadModel() {
    setDownload(0)
    try {
      await hybridAI.prepareOnDevice(locale, ratio => setDownload(ratio))
    } catch (error) {
      console.error('[fiche-express]', error)
    }
    setDownload(null)
    refreshDevice()
  }

  function remove(id: string) {
    const next = draftsRef.current.filter(d => d.id !== id)
    store(next)
    setPhase(id, null)
    if (currentId === id) setCurrentId(next[0]?.id ?? null)
  }

  const current = drafts.find(d => d.id === currentId) ?? null
  const phase = current ? phases[current.id] : undefined
  const step = current ? nextStep(current) : 'done'
  const badge = (source: AiSource) => (
    <SourceBadge source={source} label={source === 'on_device' ? t.badgeOnDevice : t.badgeCloud} />
  )
  // Torix est l'aiguilleur : il dit où part la demande, puis ce qu'il a fait.
  const torixLine = !current ? null
    : step === 'quick' && phase === 'running' ? (device === 'available' ? t.torixOnDevice : t.torixCloud)
    : step === 'enrich' && phase === 'running' ? t.enrichRunning
    : step === 'enrich' && phase === 'waiting' ? t.enrichWaiting
    : step === 'done' ? (current.quick?.source === 'on_device' ? t.torixDoneHybrid : t.torixDoneCloud)
    : null
  const src = (d: Draft) => `data:${d.photo.mimeType};base64,${d.photo.base64}`

  return (
    <>
      <Head>
        <title>{t.metaTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="root">
        <header className="top">
          <Link href="/" legacyBehavior passHref><a className="brand">Tiroir</a></Link>
          <div className="status" aria-live="polite">
            <span className={`pill ${online ? 'on' : 'off'}`}>{online ? t.online : t.offline}</span>
            {device && (
              <span className={`pill ${device === 'available' ? 'on' : 'neutral'}`}>
                {t.deviceLabel} : {t.device[device]}
              </span>
            )}
          </div>
        </header>

        <main className="main">
          <h1 className="page-title">{t.title}</h1>
          <p className="intro">{t.intro}</p>

          {!configured && <p className="notice error" role="alert">{t.notConfigured}</p>}

          {configured && (
            <div className="actions">
              <label className="btn primary">
                {current ? t.pickAgain : t.pick}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={e => { void onPick(e.target.files?.[0]); e.target.value = '' }}
                />
              </label>
              {device === 'downloadable' && download === null && online && (
                <button type="button" className="btn" onClick={downloadModel}>{t.download}</button>
              )}
              {download !== null && (
                <span className="progress" role="status">
                  {fill(t.downloadProgress, { percent: Math.round(download * 100) })}
                </span>
              )}
            </div>
          )}
          {photoError && <p className="notice error" role="alert">{t.photoFailed}</p>}

          {current && (
            <article className="card">
              <img className="photo" src={src(current)} alt={t.photoAlt} />
              <div className="body">
                <ol className="steps" aria-label={t.title}>
                  <li className={current.quick ? 'done' : step === 'quick' && phase === 'running' ? 'active' : ''}>
                    <span className="dot" aria-hidden="true" />
                    {t.stepQuick}
                    {current.quick && badge(current.quick.source)}
                  </li>
                  <li className={current.enrichment ? 'done' : step === 'enrich' && phase === 'running' ? 'active' : ''}>
                    <span className="dot" aria-hidden="true" />
                    {t.stepEnrich}
                    {current.enrichment && badge(current.enrichment.source)}
                  </li>
                </ol>

                <p className="state" role="status">
                  {step === 'done' && <strong className="ok">{t.complete}</strong>}
                  {step !== 'done' && current.quick && <strong>{t.draft}</strong>}
                  {step === 'quick' && phase === 'waiting' && <span> {t.quickWaiting}</span>}
                  {phase === 'failed' && (
                    <span className="fail">
                      {' '}{t.failed}{' '}
                      <button type="button" className="link" onClick={() => void advance(current.id, navigator.onLine)}>
                        {t.retry}
                      </button>
                    </span>
                  )}
                </p>

                {torixLine && (
                  <p className="torix" role="status" key={torixLine}>
                    <span className="spark" aria-hidden="true">✦</span>
                    <span>{torixLine}</span>
                  </p>
                )}

                {current.quick && (
                  <dl className="fields appear">
                    <div><dt>{t.name} {badge(current.quick.source)}</dt><dd className="name">{current.quick.data.name}</dd></div>
                    <div><dt>{t.category} {badge(current.quick.source)}</dt><dd>{current.quick.data.category}</dd></div>
                    <div><dt>{t.description} {badge(current.quick.source)}</dt><dd>{current.quick.data.description}</dd></div>
                  </dl>
                )}

                {current.enrichment && (
                  <dl className="fields appear enriched">
                    <div>
                      <dt>{t.detailed} {badge(current.enrichment.source)}</dt>
                      <dd>{current.enrichment.data.detailedDescription}</dd>
                    </div>
                    <div>
                      <dt>{t.value} {badge(current.enrichment.source)}</dt>
                      {current.enrichment.data.value ? (
                        <dd>
                          <span className="value">
                            {fill(t.valueRange, {
                              low: formatEur(current.enrichment.data.value.low, locale),
                              high: formatEur(current.enrichment.data.value.high, locale),
                            })}
                          </span>
                          <span className="note">{current.enrichment.data.value.note}</span>
                          <span className="signed">{t.signedTorix}</span>
                        </dd>
                      ) : (
                        <dd>{t.valueNone}</dd>
                      )}
                    </div>
                  </dl>
                )}

                <button type="button" className="link remove" onClick={() => remove(current.id)}>{t.remove}</button>
              </div>
            </article>
          )}

          {drafts.length > 1 && (
            <section className="list" aria-label={t.drafts}>
              <h2>{t.drafts}</h2>
              <ul>
                {drafts.map(d => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={`thumb ${d.id === currentId ? 'current' : ''}`}
                      onClick={() => setCurrentId(d.id)}
                    >
                      <img src={src(d)} alt="" />
                      <span>{d.quick?.data.name ?? t.draft}</span>
                      <small>{nextStep(d) === 'done' ? t.complete : t.draft}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="privacy">{t.privacy}</p>
        </main>
      </div>

      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); }
        .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; max-width: 880px; margin: 0 auto; }
        .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.3px; color: var(--ink); text-decoration: none; }
        .status { display: flex; flex-wrap: wrap; gap: 8px; }
        .pill { font-size: 12px; font-weight: 600; padding: 5px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--white); color: var(--muted); }
        .pill.on { color: var(--success); border-color: var(--sage); }
        .pill.off { color: var(--error); border-color: var(--error); background: var(--error-light); }
        .main { max-width: 880px; margin: 0 auto; padding: 16px 16px 64px; }
        .page-title { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.15; margin: 0 0 8px; }
        .intro { font-size: 15px; line-height: 1.5; color: var(--muted); margin: 0 0 24px; max-width: 60ch; }
        .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 24px; }
        .btn { display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
        .btn.primary { background: var(--orange); border-color: var(--orange); color: var(--white); }
        .btn.primary:hover { background: var(--orange-700); border-color: var(--orange-700); }
        .btn input { position: absolute; width: 1px; height: 1px; opacity: 0; }
        .btn:focus-within, .btn:focus-visible, .link:focus-visible, .thumb:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        .progress { font-size: 14px; color: var(--muted); }
        .notice { font-size: 14px; line-height: 1.5; padding: 12px 14px; border-radius: 12px; margin: 0 0 24px; }
        .notice.error { background: var(--error-light); color: var(--error); }
        .card { display: grid; grid-template-columns: minmax(0, 280px) minmax(0, 1fr); gap: 20px; padding: 16px; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); box-shadow: var(--shadow); }
        .photo { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; display: block; background: var(--beige); }
        .body { min-width: 0; }
        .steps { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 0 0 12px; padding: 0; font-size: 13px; font-weight: 600; color: var(--text-tertiary); }
        .steps li { display: flex; align-items: center; gap: 8px; }
        .steps li.active, .steps li.done { color: var(--ink); }
        .dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--border); }
        .steps li.done .dot { background: var(--sage); border-color: var(--sage); }
        .steps li.active .dot { border-color: var(--orange); animation: pulse 1s ease-in-out infinite; }
        .state { font-size: 14px; line-height: 1.5; color: var(--muted); margin: 0 0 12px; min-height: 21px; }
        .torix { display: flex; gap: 8px; align-items: baseline; margin: 0 0 16px; padding: 10px 12px; border-radius: 12px; background: var(--beige); border: 1px solid var(--border); font-size: 14px; line-height: 1.5; font-weight: 600; color: var(--ink); animation: appear 0.45s ease-out; }
        .spark { color: var(--orange); font-size: 15px; }
        .state strong { color: var(--ink); }
        .state .ok { color: var(--success); }
        .fail { color: var(--error); }
        .fields { margin: 0; display: grid; gap: 14px; }
        .fields.enriched { margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--border); }
        dt { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 4px; }
        dd { margin: 0; font-size: 15px; line-height: 1.5; overflow-wrap: anywhere; }
        dd.name { font-size: 20px; font-weight: 700; line-height: 1.25; }
        .value { display: block; font-size: 20px; font-weight: 700; }
        .note, .signed { display: block; font-size: 13px; color: var(--muted); margin-top: 4px; }
        .signed { font-style: italic; }
        .link { background: none; border: 0; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--orange-700); text-decoration: underline; cursor: pointer; }
        .remove { margin-top: 16px; color: var(--muted); }
        .appear { animation: appear 0.45s ease-out; }
        .list { margin-top: 32px; }
        .list h2 { font-size: 17px; font-weight: 700; margin: 0 0 12px; }
        .list ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
        .thumb { width: 100%; display: flex; flex-direction: column; gap: 4px; padding: 8px; text-align: left; background: var(--white); border: 1.5px solid var(--border-light); border-radius: 12px; font: inherit; font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer; }
        .thumb.current { border-color: var(--orange); }
        .thumb img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; display: block; }
        .thumb span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .thumb small { font-weight: 500; color: var(--muted); }
        .privacy { font-size: 13px; line-height: 1.5; color: var(--muted); margin: 32px 0 0; max-width: 60ch; }
        @keyframes appear { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.5); } }
        @media (max-width: 640px) {
          .card { grid-template-columns: minmax(0, 1fr); }
          .page-title { font-size: 26px; }
        }
        @media (prefers-reduced-motion: reduce) { .appear, .torix, .steps li.active .dot { animation: none; } }
      `}</style>
    </>
  )
}
