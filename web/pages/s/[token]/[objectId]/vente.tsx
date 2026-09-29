// pages/s/[token]/[objectId]/vente.tsx — PROTOTYPE de fiche de vente (V4,
// v4/docs/vente.md) : un objet déjà partagé, présenté pour la vente — le
// produit, son propriétaire, son histoire, son état, un prix « à débattre »
// et « Faire une offre ». Aucune offre n'est envoyée : c'est un aperçu.
//
// Mêmes règles que la fiche du partage : lien valide, mot de passe si le
// partage en a un, objet inclus dans le partage, et ce que le partage masque
// n'est pas chargé. Jamais le prix d'achat (lib/saleSheet.ts).
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { createClient } from '@supabase/supabase-js'
import HeaderTiroirWeb from '../../../../components/layout/HeaderTiroirWeb'
import { hasSignedCookie } from '../../../../lib/shareCookieSignature'
import { firstNameOf } from '../../../../lib/suggestions'
import { buildSaleSheet, parseOffer, type SaleInput, type SaleSheet } from '../../../../lib/saleSheet'

type Props = {
  token: string
  objectId: string
  title: string | null
  description: string | null
  images: string[]
  owner: string
  sheet: SaleSheet | null
  error?: 'not_found' | 'expired' | 'gated'
}

type Fields = { values: boolean; attributes: boolean; description: boolean }

function money(n: number, currency: string) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 })
}

const empty = (token: string, objectId: string, error: Props['error']): { props: Props } => ({
  props: { token, objectId, title: null, description: null, images: [], owner: '', sheet: null, error },
})

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  const token = String(ctx.params?.token ?? '').trim()
  const objectId = String(ctx.params?.objectId ?? '').trim()
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: link } = await admin
    .from('share_links')
    .select('user_id, object_ids, options, expires_at, is_archived')
    .eq('token', token)
    .single()
  if (!link) return empty(token, objectId, 'not_found')
  if (link.is_archived || (link.expires_at && new Date(link.expires_at) < new Date())) return empty(token, objectId, 'expired')
  if (link.options?.password_protected && !hasSignedCookie(token, ctx.req)) return empty(token, objectId, 'gated')
  const ids: string[] = Array.isArray(link.object_ids) ? link.object_ids : []
  if (!ids.includes(objectId)) return empty(token, objectId, 'not_found')

  const fields: Fields = { values: true, attributes: true, description: true, ...(link.options?.fields ?? {}) }
  const columns = [
    'id', 'title', 'status', 'quantity', 'created_at', 'purchase_date',
    ...(fields.description ? ['description'] : []),
    ...(fields.attributes ? ['attributes'] : []),
    ...(fields.values ? ['sale_price', 'sale_price_lot', 'user_value', 'market_value', 'value_currency', 'value_sources'] : []),
  ].join(', ')

  const [{ data: row }, { data: profile }, { data: imgRows }] = await Promise.all([
    admin.from('objects').select(columns).eq('id', objectId).single(),
    admin.from('profiles').select('display_name').eq('id', link.user_id).single(),
    admin.from('object_images').select('storage_path').eq('object_id', objectId).order('position'),
  ])
  if (!row) return empty(token, objectId, 'not_found')

  const o = {
    description: null, attributes: null, sale_price: null, sale_price_lot: null,
    user_value: null, market_value: null, value_currency: null, value_sources: null,
    ...(row as unknown as Record<string, unknown>),
  } as unknown as SaleInput

  let images: string[] = []
  if (imgRows?.length) {
    const { data: signed } = await admin.storage.from('object-images').createSignedUrls(imgRows.map(r => r.storage_path), 3600)
    images = (signed ?? []).map(s => s.signedUrl).filter(Boolean) as string[]
  }

  const owner = firstNameOf(profile?.display_name)
  return {
    props: {
      token, objectId, images, owner,
      title: o.title, description: o.description,
      sheet: buildSaleSheet(o, owner),
    },
  }
}

export default function SalePrototype({ token, objectId, title, description, images, owner, sheet, error }: Props) {
  const [active, setActive] = useState(0)
  const [offerOpen, setOfferOpen] = useState(false)
  const [amount, setAmount] = useState(sheet?.suggestedOffer ? String(sheet.suggestedOffer) : '')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState<number | null>(null)
  const offer = parseOffer(amount)

  if (error || !sheet || !title) {
    const text = error === 'gated'
      ? 'Ce partage est protégé : ouvre-le d’abord et saisis son mot de passe.'
      : error === 'expired' ? 'Ce partage a expiré.' : 'Cet objet est introuvable.'
    return (
      <>
        <Head><title>Fiche de vente — Tiroir</title><meta name="robots" content="noindex,nofollow" /></Head>
        <HeaderTiroirWeb />
        <main className="wrap"><p className="muted">{text}</p>
          <Link href={`/s/${token}`} legacyBehavior passHref><a className="link">← Retour au partage</a></Link>
        </main>
        <style jsx>{styles}</style>
      </>
    )
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (offer) setSent(offer)
  }

  const price = sheet.askingPrice
  return (
    <>
      <Head>
        <title>{`${title} — à vendre sur Tiroir`}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <HeaderTiroirWeb />

      <main className="wrap">
        <p className="proto">Prototype de vente — aucune offre n’est envoyée pour l’instant.</p>

        <Link href={`/s/${token}/${objectId}`} legacyBehavior passHref>
          <a className="link">← Fiche du partage</a>
        </Link>

        <section className="gallery">
          {images.length ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="main-img" src={images[active]} alt={title} />
              {images.length > 1 && (
                <div className="thumbs">
                  {images.map((src, i) => (
                    <button key={src} type="button" className={`thumb${i === active ? ' on' : ''}`} onClick={() => setActive(i)} aria-label={`Photo ${i + 1}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="no-img">Pas encore de photo</div>
          )}
        </section>

        <h1 className="title">{title}</h1>

        <section className="price-card">
          {sheet.sold ? (
            <p className="sold">Déjà vendu</p>
          ) : (
            <>
              <div className="price-row">
                <span className="price">{price ? money(price, sheet.currency) : 'Prix à discuter'}</span>
                <span className="chip">À débattre</span>
              </div>
              <p className="muted small">
                {sheet.priceOrigin === 'vendeur' && `Prix indicatif fixé par ${owner}. Fais une offre : c’est une vente à l’amiable.`}
                {sheet.priceOrigin === 'estimation' && `Pas encore de prix fixé : repère tiré de l’estimation de Tiroir. Propose le tien.`}
                {sheet.priceOrigin === null && `${owner} n’a pas encore fixé de prix. Propose le tien.`}
              </p>
              {sheet.range && (
                <p className="muted small">Estimé entre {money(sheet.range.min, sheet.currency)} et {money(sheet.range.max, sheet.currency)} sur le marché.</p>
              )}
            </>
          )}
        </section>

        <section className="owner">
          <span className="avatar" aria-hidden>{owner.charAt(0).toUpperCase()}</span>
          <div>
            <p className="owner-name">Proposé par {owner}</p>
            <p className="muted small">Membre de Tiroir · vente entre particuliers</p>
          </div>
        </section>

        {(description || sheet.story.length > 0) && (
          <section className="block">
            <h2>Son histoire</h2>
            {description && <p className="text">{description}</p>}
            {sheet.story.length > 0 && (
              <div className="facts">{sheet.story.map(s => <p key={s}>{s}</p>)}</div>
            )}
          </section>
        )}

        <section className="block">
          <h2>État et usage</h2>
          {sheet.condition.length ? (
            <dl className="dl">
              {sheet.condition.map(c => (<div key={c.label}><dt>{c.label}</dt><dd>{c.value}</dd></div>))}
            </dl>
          ) : (
            <p className="muted small">{owner} n’a pas encore décrit l’état. Pose-lui la question avec ton offre.</p>
          )}
        </section>

        {sheet.details.length > 0 && (
          <section className="block">
            <h2>Détails</h2>
            <dl className="dl">
              {sheet.details.map(c => (<div key={c.label}><dt>{c.label}</dt><dd>{c.value}</dd></div>))}
            </dl>
          </section>
        )}

        <section className="block">
          <h2>Comment ça se passe</h2>
          <div className="steps">
            <p><span className="n">1</span>Tu proposes un prix, avec un mot pour {owner}.</p>
            <p><span className="n">2</span>{owner} accepte, refuse ou te fait une contre-proposition.</p>
            <p><span className="n">3</span>Vous convenez de la remise, en main propre pour commencer.</p>
          </div>
        </section>
      </main>

      {!sheet.sold && (
        <div className="bar">
          <button type="button" className="cta" onClick={() => { setSent(null); setOfferOpen(true) }}>Faire une offre</button>
        </div>
      )}

      {offerOpen && (
        <div className="backdrop" onClick={() => setOfferOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="offer-title" onClick={e => e.stopPropagation()}>
            {sent !== null ? (
              <>
                <h2 id="offer-title">Offre prête : {money(sent, sheet.currency)}</h2>
                <p className="text">
                  C’est un prototype : rien n’est envoyé. Dans la vraie version, {owner} reçoit ton offre
                  {message.trim() ? ' et ton message' : ''}, puis l’accepte, la refuse ou te propose un autre prix.
                </p>
                <button type="button" className="cta" onClick={() => setOfferOpen(false)}>Fermer</button>
              </>
            ) : (
              <form onSubmit={submit}>
                <h2 id="offer-title">Ton offre à {owner}</h2>
                {price && <p className="muted small">Prix indicatif : {money(price, sheet.currency)}.</p>}
                <label className="label" htmlFor="offer-amount">Ton prix</label>
                <input id="offer-amount" className="input" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Montant" />
                <label className="label" htmlFor="offer-msg">Un mot (facultatif)</label>
                <textarea id="offer-msg" className="input area" value={message} maxLength={500} onChange={e => setMessage(e.target.value)} placeholder={`Bonjour ${owner}, …`} />
                <button type="submit" className="cta" disabled={!offer}>Proposer {offer ? money(offer, sheet.currency) : ''}</button>
                <button type="button" className="ghost" onClick={() => setOfferOpen(false)}>Annuler</button>
              </form>
            )}
          </div>
        </div>
      )}

      <style jsx>{styles}</style>
    </>
  )
}

const styles = `
  .wrap { max-width: 640px; margin: 0 auto; padding: 16px 16px 120px; font-family: var(--font-body); color: var(--ink); }
  .proto { background: var(--beige); color: var(--orange-700); font-size: 13px; font-weight: 600; padding: 8px 12px; border-radius: 10px; margin: 0 0 12px; }
  .link { display: inline-block; color: var(--muted); font-size: 14px; text-decoration: none; margin-bottom: 12px; }
  .muted { color: var(--muted); }
  .small { font-size: 13px; line-height: 1.5; margin: 6px 0 0; }
  .gallery { margin-bottom: 16px; }
  .main-img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: var(--radius); background: var(--surface-subtle); display: block; }
  .no-img { aspect-ratio: 4 / 3; border-radius: var(--radius); background: var(--surface-subtle); display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); }
  .thumbs { display: flex; gap: 8px; margin-top: 8px; overflow-x: auto; }
  .thumb { flex: none; width: 56px; height: 56px; padding: 0; border-radius: 10px; overflow: hidden; border: 2px solid transparent; background: none; cursor: pointer; }
  .thumb.on { border-color: var(--orange); }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .title { font-size: 26px; font-weight: 800; margin: 0 0 12px; line-height: 1.2; }
  .price-card { background: var(--beige-2); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 16px; margin-bottom: 16px; }
  .price-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .price { font-size: 28px; font-weight: 800; }
  .chip { font-size: 12px; font-weight: 700; color: var(--orange-700); background: var(--white); border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; }
  .sold { margin: 0; font-weight: 700; color: var(--muted); }
  .owner { display: flex; align-items: center; gap: 12px; padding: 12px 0 16px; border-bottom: 1px solid var(--border-light); }
  .avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--orange); color: var(--white); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; flex: none; }
  .owner-name { margin: 0; font-weight: 700; }
  .block { padding: 16px 0; border-bottom: 1px solid var(--border-light); }
  .block h2 { font-size: 17px; margin: 0 0 8px; }
  .text { margin: 0 0 8px; line-height: 1.6; white-space: pre-line; }
  .cta, .ghost { text-align: center; display: block; }
  .facts p { margin: 4px 0 0; color: var(--muted); font-size: 14px; line-height: 1.5; }
  .steps p { display: flex; gap: 10px; align-items: flex-start; margin: 0 0 10px; line-height: 1.5; }
  .n { flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--beige); color: var(--orange-700); font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; }
  .dl { margin: 0; display: grid; gap: 8px; }
  .dl div { display: flex; justify-content: space-between; gap: 12px; }
  .dl dt { color: var(--muted); }
  .dl dd { margin: 0; font-weight: 600; text-align: right; }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: var(--white); border-top: 1px solid var(--border-light); display: flex; justify-content: center; }
  .cta { width: 100%; max-width: 608px; padding: 15px 20px; border-radius: 12px; border: 0; background: var(--orange); color: var(--white); font-weight: 700; font-size: 16px; cursor: pointer; }
  .cta:disabled { opacity: 0.5; cursor: default; }
  .ghost { width: 100%; margin-top: 8px; padding: 12px; border: 0; background: none; color: var(--muted); font-weight: 600; font-size: 15px; cursor: pointer; }
  .backdrop { position: fixed; inset: 0; z-index: 50; background: rgba(18, 18, 18, 0.45); display: flex; align-items: flex-end; justify-content: center; }
  .sheet { width: 100%; max-width: 640px; background: var(--white); border-radius: 20px 20px 0 0; padding: 24px 16px calc(16px + env(safe-area-inset-bottom)); font-family: var(--font-body); color: var(--ink); }
  .sheet h2 { margin: 0 0 6px; font-size: 20px; }
  .label { display: block; font-size: 13px; font-weight: 600; margin: 14px 0 6px; }
  .input { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 10px; border: 1px solid var(--border); font-size: 16px; font-family: inherit; }
  .area { min-height: 84px; resize: vertical; }
  form .cta { margin-top: 16px; }
`
