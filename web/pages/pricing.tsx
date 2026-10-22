import Head from 'next/head'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import { localeLinks } from '../components/layout/LocaleLinks'
import StoreButtons from '../components/StoreButtons'
import { OFFERS_V4 } from '../lib/offers'
import { fill, formatEur, useCopy } from '../locales'

// Grille V4 (page Notion « Page Tarifs — textes V4 »). Tous les prix
// viennent de lib/offers.ts : la page, Torix et les tests lisent la même
// source. Textes dans web/locales (pricing), en cinq langues ; prix au
// format de la langue.
//
// Le paiement n'est pas encore ouvert (Stripe en mode test) : les boutons
// d'achat affichent « Bientôt disponible » et ne mènent nulle part. Seul le
// gratuit renvoie vers les stores, et Business vers une adresse e-mail.
const { free, packs, premium, pro, business } = OFFERS_V4

const PLAN_CARD: React.CSSProperties = { padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }
const PLAN_NAME: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }
const PRICE: React.CSSProperties = { fontSize: 38, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }
const PRICE_UNIT: React.CSSProperties = { fontSize: 15, color: 'var(--muted)' }
const PRICE_SUB: React.CSSProperties = { fontSize: 14, color: 'var(--muted)', marginTop: 6 }
const LIST: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }
const ITEM: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: 'var(--ink)', lineHeight: 1.35 }

export default function Pricing() {
  const { t: { pricing: t }, locale } = useCopy()
  const eur = (n: number) => formatEur(n, locale)
  const n = free.aiActionsPerMonth
  return (
    <>
      <Head>
        <title>{t.meta.title}</title>
        <meta
          name="description"
          content={fill(t.meta.description, {
            free: n, pack: eur(packs[0].priceTtc), premium: eur(premium.monthlyTtc),
            pro: eur(pro.monthlyTtc), business: eur(business.seatMonthly),
          })}
        />
        {localeLinks(locale, '/pricing')}
      </Head>

      <HeaderTiroirWeb />

      <main>
        {/* ── Accroche ── */}
        <section className="section" style={{ background: 'var(--beige)', textAlign: 'center', paddingBottom: 48 }}>
          <div className="container" style={{ maxWidth: 640 }}>
            <div style={{ display: 'inline-block', background: '#FFE4CC', color: 'var(--orange)', padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
              {t.badge}
            </div>
            <h1 className="h1" style={{ marginBottom: 16 }}>{t.title}</h1>
            <p className="p" style={{ fontSize: 18, maxWidth: 520, margin: '0 auto' }}>
              {t.sub}
            </p>
          </div>
        </section>

        {/* ── Formules ── */}
        <section className="section" style={{ paddingTop: 48 }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 20, maxWidth: 1180, margin: '0 auto', alignItems: 'stretch' }}>

              {/* Free */}
              <div className="card" style={PLAN_CARD}>
                <div>
                  <div style={PLAN_NAME}>Free</div>
                  <div style={PRICE}>{eur(0)}</div>
                  <div style={PRICE_SUB}>{t.free.tagline}</div>
                </div>
                <ul style={LIST}>
                  {t.free.features.map(f => fill(f, { n })).map(f => (
                    <li key={f} style={ITEM}><CheckIcon /> {f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>{t.free.start}</div>
                  <StoreButtons variant="card" full locale={locale} />
                </div>
              </div>

              {/* Premium */}
              <div className="card" style={{ ...PLAN_CARD, border: '2px solid var(--orange)' }}>
                <div>
                  <div style={{ ...PLAN_NAME, color: 'var(--orange)' }}>Premium</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                    <span style={PRICE}>{eur(premium.monthlyTtc)}</span>
                    <span style={PRICE_UNIT}>{t.perMonth}</span>
                  </div>
                  <div style={PRICE_SUB}>{fill(t.perYear, { price: eur(premium.yearlyTtc) })}</div>
                  <div style={PRICE_SUB}>{t.premium.tagline}</div>
                </div>
                <ul style={LIST}>
                  {t.premium.features.map(f => (
                    <li key={f} style={ITEM}><CheckIcon orange /> {f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <SoonButton label={t.premium.cta} soon={t.soon} primary />
                </div>
              </div>

              {/* Pro */}
              <div className="card" style={PLAN_CARD}>
                <div>
                  <div style={PLAN_NAME}>Pro</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                    <span style={PRICE}>{eur(pro.monthlyTtc)}</span>
                    <span style={PRICE_UNIT}>{t.perMonth}</span>
                  </div>
                  <div style={PRICE_SUB}>{t.pro.tagline}</div>
                </div>
                <ul style={LIST}>
                  {t.pro.features.map(f => (
                    <li key={f} style={ITEM}><CheckIcon /> {f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <SoonButton label={t.pro.cta} soon={t.soon} />
                </div>
              </div>

              {/* Business — sur facture */}
              <div className="card" style={{ ...PLAN_CARD, background: 'var(--ink)', color: 'white' }}>
                <div>
                  <div style={{ ...PLAN_NAME, color: 'rgba(255,255,255,0.7)' }}>Business</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ ...PRICE, color: 'white' }}>{eur(business.seatMonthly)}</span>
                    <span style={{ ...PRICE_UNIT, color: 'rgba(255,255,255,0.7)' }}>{t.perSeat}</span>
                  </div>
                  <div style={{ ...PRICE_SUB, color: 'rgba(255,255,255,0.7)' }}>{t.business.tagline}</div>
                </div>
                <ul style={LIST}>
                  {t.business.features.map(f => (
                    <li key={f} style={{ ...ITEM, color: 'white' }}><CheckIcon dark /> {f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <a
                    href="mailto:hello@tiroir.app?subject=Tiroir%20Business"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '13px 16px', borderRadius: 12, background: 'white',
                      color: 'var(--ink)', fontWeight: 700, fontSize: 15, textDecoration: 'none',
                    }}
                  >
                    {t.business.cta}
                  </a>
                </div>
              </div>

            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', maxWidth: 640, margin: '24px auto 0' }}>
              {t.note}
            </p>
          </div>
        </section>

        {/* ── Crédits IA ── */}
        <section className="section" style={{ background: 'var(--beige-2)' }}>
          <div className="container" style={{ maxWidth: 680 }}>
            <h2 className="h2" style={{ marginBottom: 12 }}>{t.credits.title}</h2>
            <p className="p" style={{ marginBottom: 24 }}>
              {t.credits.sub}
            </p>
            <div className="card" style={{ padding: '4px 20px' }}>
              {packs.map((p, i) => (
                <div key={p.credits} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '16px 0', borderTop: i === 0 ? undefined : '1px solid rgba(0,0,0,0.06)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {fill(t.credits.unit, { n: p.credits.toLocaleString(locale) })}
                    {p.popular && (
                      <span style={{ background: 'var(--orange)', color: 'white', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
                        {t.credits.popular}
                      </span>
                    )}
                  </span>
                  <strong style={{ fontSize: 16, whiteSpace: 'nowrap' }}>{eur(p.priceTtc)}</strong>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: '16px 0 20px' }}>
              {t.credits.note}
            </p>
            <div style={{ maxWidth: 320 }}>
              <SoonButton label={t.credits.cta} soon={t.soon} primary />
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="section">
          <div className="container" style={{ maxWidth: 680 }}>
            <h2 className="h2" style={{ marginBottom: 32 }}>{t.faqTitle}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {t.faq.map(({ q, a }, i) => (
                <div key={q} style={{ borderTop: i === 0 ? '1px solid rgba(0,0,0,0.08)' : undefined, borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '20px 0' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{q}</div>
                  <div style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>{a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="section">
          <div className="container">
            <div className="cta-final">
              <h3 className="h2" style={{ color: 'white' }}>{t.final.title}</h3>
              <p style={{ opacity: 0.85, marginTop: 8 }}>
                {fill(t.final.sub, { n })}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <StoreButtons variant="onColor" locale={locale} />
              </div>
            </div>
          </div>
        </section>
      </main>

      <FooterTiroirWeb />
    </>
  )
}

/** Bouton d'achat inactif : le paiement n'est pas ouvert (Stripe en mode test). */
function SoonButton({ label, soon, primary }: { label: string; soon: string; primary?: boolean }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-label={`${label} — ${soon}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        width: '100%', padding: '11px 16px', borderRadius: 12, cursor: 'not-allowed',
        border: primary ? 'none' : '1px solid rgba(0,0,0,0.12)',
        background: primary ? 'var(--orange)' : 'white',
        color: primary ? 'white' : 'var(--ink)',
        opacity: 0.6, fontFamily: 'inherit',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 15 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{soon}</span>
    </button>
  )
}

function CheckIcon({ orange, dark }: { orange?: boolean; dark?: boolean }) {
  const bg = dark ? 'rgba(255,255,255,0.15)' : orange ? '#FFF0E6' : '#F4F4F2'
  const fg = dark ? 'white' : orange ? 'var(--orange)' : '#888'
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="8" cy="8" r="8" fill={bg} />
      <path d="M5 8l2 2 4-4" stroke={fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
