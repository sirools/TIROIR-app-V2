import Head from 'next/head'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import StoreButtons from '../components/StoreButtons'
import { OFFERS_V4, credits, euros } from '../lib/offers'
import { useCopy } from '../locales'

// Grille V4 (page Notion « Page Tarifs — textes V4 »). Tous les prix
// viennent de lib/offers.ts : la page, Torix et les tests lisent la même
// source.
//
// Le paiement sur le web n'est pas ouvert (Stripe en mode test). Premium et
// les crédits s'achètent dans l'app (App Store / Google Play, RevenueCat) :
// leurs boutons mènent aux stores. Pro reste « Bientôt disponible » — l'app
// ne le vend pas encore — et Business renvoie vers une adresse e-mail.
const { free, packs, premium, pro, business } = OFFERS_V4

const FAQ = [
  {
    q: 'Qu’est-ce qu’une action IA ?',
    a: 'Une identification ou une estimation d’objet.',
  },
  {
    q: 'Que se passe-t-il quand mon quota est épuisé ?',
    a: 'Tiroir reste utilisable ; seules les actions IA demandent des crédits.',
  },
  {
    q: 'Les estimations sont-elles influencées par des partenaires ?',
    a: 'Non. Les estimations ne sont jamais influencées par nos partenaires : les offres marchandes sont séparées de l’estimation de valeur.',
  },
  {
    q: 'Puis-je résilier ?',
    a: 'À tout moment, depuis l’App Store, le Play Store ou votre compte.',
  },
]

const PLAN_CARD: React.CSSProperties = { padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }
const PLAN_NAME: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }
const PRICE: React.CSSProperties = { fontSize: 38, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }
const PRICE_UNIT: React.CSSProperties = { fontSize: 15, color: 'var(--muted)' }
const PRICE_SUB: React.CSSProperties = { fontSize: 14, color: 'var(--muted)', marginTop: 6 }
const LIST: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }
const ITEM: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: 'var(--ink)', lineHeight: 1.35 }

export default function Pricing() {
  const { t: { inApp } } = useCopy()
  return (
    <>
      <Head>
        <title>Tarifs — Tiroir</title>
        <meta
          name="description"
          content={`Tiroir est gratuit, avec ${free.aiActionsPerMonth} actions IA par mois. Crédits IA dès ${euros(packs[0].priceTtc)}, Premium à ${euros(premium.monthlyTtc)} par mois, Pro à ${euros(pro.monthlyTtc)} par mois, Business à ${euros(business.seatMonthly)} par siège.`}
        />
      </Head>

      <HeaderTiroirWeb />

      <main>
        {/* ── Accroche ── */}
        <section className="section" style={{ background: 'var(--beige)', textAlign: 'center', paddingBottom: 48 }}>
          <div className="container" style={{ maxWidth: 640 }}>
            <div style={{ display: 'inline-block', background: '#FFE4CC', color: 'var(--orange)', padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
              Tarifs
            </div>
            <h1 className="h1" style={{ marginBottom: 16 }}>Rangez tout. Sachez ce que ça vaut.</h1>
            <p className="p" style={{ fontSize: 18, maxWidth: 520, margin: '0 auto' }}>
              Tiroir est gratuit pour tout le monde. Payez seulement quand vous allez plus loin.
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
                  <div style={PRICE}>0 €</div>
                  <div style={PRICE_SUB}>Pour cataloguer tout ce que vous possédez.</div>
                </div>
                <ul style={LIST}>
                  {[
                    'Objets et collections illimités',
                    `${free.aiActionsPerMonth} actions IA par mois (identification, estimation)`,
                    'Partage de collections en lecture seule',
                    'Crédits IA en plus, à la demande',
                  ].map(f => (
                    <li key={f} style={ITEM}><CheckIcon /> {f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>Commencer gratuitement</div>
                  <StoreButtons variant="card" full />
                </div>
              </div>

              {/* Premium */}
              <div className="card" style={{ ...PLAN_CARD, border: '2px solid var(--orange)' }}>
                <div>
                  <div style={{ ...PLAN_NAME, color: 'var(--orange)' }}>Premium</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                    <span style={PRICE}>{euros(premium.monthlyTtc)}</span>
                    <span style={PRICE_UNIT}>/mois</span>
                  </div>
                  <div style={PRICE_SUB}>ou {euros(premium.yearlyTtc)} par an</div>
                  <div style={PRICE_SUB}>Pour suivre la valeur de votre collection.</div>
                </div>
                <ul style={LIST}>
                  {[
                    'Estimation automatique avec quota mensuel',
                    'Courbe de suivi de valeur et bouton Actualiser',
                    'Sources résumées en une ligne',
                    'Suggestions d’objets par vos proches',
                    'Liens de partage protégés par mot de passe',
                  ].map(f => (
                    <li key={f} style={ITEM}><CheckIcon orange /> {f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <InAppBuy label={inApp.subscribe} note={inApp.subscriptionNote} />
                </div>
              </div>

              {/* Pro */}
              <div className="card" style={PLAN_CARD}>
                <div>
                  <div style={PLAN_NAME}>Pro</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                    <span style={PRICE}>{euros(pro.monthlyTtc)}</span>
                    <span style={PRICE_UNIT}>/mois</span>
                  </div>
                  <div style={PRICE_SUB}>Pour ceux qui vivent de leurs objets.</div>
                </div>
                <ul style={LIST}>
                  {[
                    'IA incluse, sans recharge',
                    'Estimation en lot',
                    'Détail des sources et comparaison marché',
                    'Export assurance',
                  ].map(f => (
                    <li key={f} style={ITEM}><CheckIcon /> {f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <SoonButton label="Passer Pro" />
                </div>
              </div>

              {/* Business — sur facture */}
              <div className="card" style={{ ...PLAN_CARD, background: 'var(--ink)', color: 'white' }}>
                <div>
                  <div style={{ ...PLAN_NAME, color: 'rgba(255,255,255,0.7)' }}>Business</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ ...PRICE, color: 'white' }}>{euros(business.seatMonthly)}</span>
                    <span style={{ ...PRICE_UNIT, color: 'rgba(255,255,255,0.7)' }}>par siège/mois</span>
                  </div>
                  <div style={{ ...PRICE_SUB, color: 'rgba(255,255,255,0.7)' }}>Pour gérer un stock en équipe.</div>
                </div>
                <ul style={LIST}>
                  {[
                    'Tout le Pro, pour chaque membre',
                    'Rôles et comptes multiples',
                    'Facturation mensuelle, virement ou prélèvement',
                  ].map(f => (
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
                    Nous contacter
                  </a>
                </div>
              </div>

            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', maxWidth: 640, margin: '24px auto 0' }}>
              Prix TTC. Business se règle sur facture.
            </p>
          </div>
        </section>

        {/* ── Crédits IA ── */}
        <section className="section" style={{ background: 'var(--beige-2)' }}>
          <div className="container" style={{ maxWidth: 680 }}>
            <h2 className="h2" style={{ marginBottom: 12 }}>Crédits IA</h2>
            <p className="p" style={{ marginBottom: 24 }}>
              Besoin de plus ? Rechargez quand vous voulez, sans abonnement.
            </p>
            <div className="card" style={{ padding: '4px 20px' }}>
              {packs.map((p, i) => (
                <div key={p.credits} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '16px 0', borderTop: i === 0 ? undefined : '1px solid rgba(0,0,0,0.06)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {credits(p.credits)} crédits
                    {p.popular && (
                      <span style={{ background: 'var(--orange)', color: 'white', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
                        Le plus choisi
                      </span>
                    )}
                  </span>
                  <strong style={{ fontSize: 16, whiteSpace: 'nowrap' }}>{euros(p.priceTtc)}</strong>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: '16px 0 20px' }}>
              Les crédits n’expirent pas.
            </p>
            <div style={{ maxWidth: 320 }}>
              <InAppBuy label={inApp.buyCredits} note={inApp.creditsNote} />
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="section">
          <div className="container" style={{ maxWidth: 680 }}>
            <h2 className="h2" style={{ marginBottom: 32 }}>Questions fréquentes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {FAQ.map(({ q, a }, i) => (
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
              <h3 className="h2" style={{ color: 'white' }}>Commencez gratuitement.</h3>
              <p style={{ opacity: 0.85, marginTop: 8 }}>
                Objets et collections illimités, {free.aiActionsPerMonth} actions IA par mois. Aucune carte bancaire requise.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <StoreButtons variant="onColor" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <FooterTiroirWeb />
    </>
  )
}

/**
 * Achat dans l'app : libellé, boutons des stores (celui du téléphone mis en
 * avant) et une phrase qui rappelle que tout se gère depuis l'app.
 */
function InAppBuy({ label, note }: { label: string; note: string }) {
  const { locale } = useCopy()
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, textAlign: 'center' }}>{label}</div>
      <StoreButtons variant="card" full highlight locale={locale} />
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0 0', textAlign: 'center' }}>{note}</p>
    </div>
  )
}

/** Bouton d'achat inactif : Pro n'est pas encore vendu (ni sur le web, ni dans l'app). */
function SoonButton({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-label={`${label} — bientôt disponible`}
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
      <span style={{ fontSize: 12, fontWeight: 500 }}>Bientôt disponible</span>
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
