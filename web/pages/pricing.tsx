import Head from 'next/head'
import { useState } from 'react'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import StoreButtons from '../components/StoreButtons'
import { OFFERS, credits, euros, proMonthlyHt } from '../lib/offers'

// Grille du 30/09/2026 (`strategie/offres.md`). Tous les prix viennent de
// lib/offers.ts : la page, Torix et les tests lisent la même source.
//
// L'échelle voulue par le fondateur : le gratuit fait découvrir l'IA, les
// packs permettent de continuer sans s'engager, le Premium devient moins
// cher dès qu'on recharge souvent, le Pro prend le relais quand l'usage
// devient un métier.
const { free, packs, premium, pro, creditCosts, legacyPremiumTtc } = OFFERS
const [smallPack, bigPack] = packs

const FAQ = [
  {
    q: 'Qu’est-ce qu’un crédit ?',
    a: `Une unité de travail de l’IA. Une fiche d’objet coûte 1 crédit, une amélioration de photo ${creditCosts[1].credits}, une estimation de valeur ${creditCosts[2].credits} : l’estimation cherche des annonces comparables sur le web, elle coûte plus cher à produire.`,
  },
  {
    q: 'Mes crédits expirent-ils ?',
    a: 'Non. Les crédits achetés restent sur votre compte tant qu’il existe, sans date limite.',
  },
  {
    q: 'Quand passer au Premium ?',
    a: `Dès que vous rechargez souvent : à ${euros(premium.monthlyTtc)} par mois, l’IA est illimitée, dans le cadre d’un usage raisonnable. Plus besoin de compter.`,
  },
  {
    q: 'Déjà abonné au Premium ?',
    a: `Vous gardez votre prix (${euros(legacyPremiumTtc)} par mois) tant que vous restez abonné. La nouvelle grille concerne les nouveaux abonnements.`,
  },
  {
    q: 'Comment fonctionne la licence Pro ?',
    a: `Un socle de ${euros(pro.baseHt)} HT par mois inclut ${credits(pro.includedCredits)} crédits. Au-delà, chaque crédit coûte ${euros(pro.extraCreditHt)} HT : vous payez ce que votre équipe consomme vraiment. Tiroir établit le devis à partir de votre consommation prévue ; il se signe en ligne ou par contrat classique, et se règle sur facture, sans passer par les stores.`,
  },
  {
    q: 'Puis-je annuler à tout moment ?',
    a: 'Oui. L’abonnement Premium se gère depuis les Réglages iOS (Apple ID → Abonnements) ou le Play Store (menu → Abonnements). Aucun engagement.',
  },
  {
    q: 'Mes données m’appartiennent-elles ?',
    a: 'Oui, dans toutes les formules : fiches, photos et documents s’exportent en entier. Vous pouvez demander la suppression complète à tout moment via support@tiroir.app.',
  },
  {
    q: 'Comment contacter le support ?',
    a: 'Écrivez-nous à support@tiroir.app. Nous répondons le plus vite possible.',
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
  const [volume, setVolume] = useState(50000)
  const quote = proMonthlyHt(volume)
  return (
    <>
      <Head>
        <title>Tarifs — Tiroir</title>
        <meta
          name="description"
          content={`Tiroir : ${free.aiObjects} objets avec l’IA offerts, des packs de crédits dès ${euros(smallPack.priceTtc)}, le Premium illimité à ${euros(premium.monthlyTtc)} par mois et une licence Pro dès ${euros(pro.baseHt)} HT par mois.`}
        />
      </Head>

      <HeaderTiroirWeb />

      <main>
        {/* ── Hero ── */}
        <section className="section" style={{ background: 'var(--beige)', textAlign: 'center', paddingBottom: 48 }}>
          <div className="container" style={{ maxWidth: 640 }}>
            <div style={{ display: 'inline-block', background: '#FFE4CC', color: 'var(--orange)', padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
              Tarifs
            </div>
            <h1 className="h1" style={{ marginBottom: 16 }}>Vous payez l’IA que vous utilisez.</h1>
            <p className="p" style={{ fontSize: 18, maxWidth: 520, margin: '0 auto' }}>
              Découvrez gratuitement, rechargez quand vous voulez, passez à l’illimité
              quand vous ne voulez plus compter, et au Pro quand c’est votre métier.
            </p>
          </div>
        </section>

        {/* ── Formules ── */}
        <section className="section" style={{ paddingTop: 48 }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 20, maxWidth: 1180, margin: '0 auto', alignItems: 'stretch' }}>

              {/* Gratuit */}
              <div className="card" style={PLAN_CARD}>
                <div>
                  <div style={PLAN_NAME}>Gratuit</div>
                  <div style={PRICE}>0 €</div>
                  <div style={PRICE_SUB}>Pour découvrir</div>
                </div>
                <ul style={LIST}>
                  {[`${free.aiObjects} objets avec l’IA, offerts`, 'Collections et recherche', 'Partage par lien', 'Export complet de vos données'].map(f => (
                    <li key={f} style={ITEM}><CheckIcon /> {f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <StoreButtons variant="card" full />
                </div>
              </div>

              {/* Packs de crédits */}
              <div className="card" style={PLAN_CARD}>
                <div>
                  <div style={PLAN_NAME}>Crédits</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <span style={PRICE}>{euros(smallPack.priceTtc)}</span>
                    <span style={PRICE_UNIT}>{smallPack.credits} crédits</span>
                  </div>
                  <div style={PRICE_SUB}>ou {euros(bigPack.priceTtc)} les {bigPack.credits} crédits</div>
                </div>
                <ul style={LIST}>
                  {['Sans abonnement', 'Les crédits n’expirent jamais', '1 crédit = 1 fiche d’objet', 'Toutes les fonctions IA, au crédit'].map(f => (
                    <li key={f} style={ITEM}><CheckIcon /> {f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>Achat dans l’app</div>
                  <StoreButtons variant="card" full />
                </div>
              </div>

              {/* Premium */}
              <div className="card" style={{ ...PLAN_CARD, border: '2px solid var(--orange)', position: 'relative', overflow: 'visible' }}>
                <div style={{ position: 'absolute', top: -14, left: 24, background: 'var(--orange)', color: 'white', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 999 }}>
                  Illimité
                </div>
                <div>
                  <div style={{ ...PLAN_NAME, color: 'var(--orange)' }}>Premium</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                    <span style={PRICE}>{euros(premium.monthlyTtc)}</span>
                    <span style={PRICE_UNIT}>/mois</span>
                  </div>
                  <div style={PRICE_SUB}>Quand vous ne voulez plus compter</div>
                </div>
                <ul style={LIST}>
                  {['IA illimitée, usage raisonnable', 'Objets et photos illimités', 'Améliorations photo et estimations de valeur', 'Assistant et aide au prix de vente', 'Documents joints et suivi des assurances'].map((f, i) => (
                    <li key={f} style={{ ...ITEM, fontWeight: i === 0 ? 600 : 400 }}><CheckIcon orange /> {f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>Sans engagement</div>
                  <StoreButtons variant="cardPrimary" full />
                </div>
              </div>

              {/* Pro — licence vendue en direct, sur devis et facture */}
              <div className="card" style={{ ...PLAN_CARD, background: 'var(--ink)', color: 'white' }}>
                <div>
                  <div style={{ ...PLAN_NAME, color: 'rgba(255,255,255,0.7)' }}>Pro</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>à partir de</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ ...PRICE, color: 'white' }}>{euros(pro.baseHt)}</span>
                    <span style={{ ...PRICE_UNIT, color: 'rgba(255,255,255,0.7)' }}>HT/mois</span>
                  </div>
                  <div style={{ ...PRICE_SUB, color: 'rgba(255,255,255,0.7)' }}>
                    {credits(pro.includedCredits)} crédits inclus, puis {euros(pro.extraCreditHt)} HT le crédit
                  </div>
                </div>
                <ul style={LIST}>
                  {['Tout Tiroir, toute l’IA', 'Au prix réel de votre consommation', 'Devis, contrat et facture mensuelle', 'Support prioritaire et mise en route', 'Sans commission de store'].map(f => (
                    <li key={f} style={{ ...ITEM, color: 'white' }}><CheckIcon dark /> {f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <a
                    href="mailto:hello@tiroir.app?subject=Licence%20Pro%20Tiroir%20%E2%80%94%20demande%20de%20devis"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '13px 16px', borderRadius: 12, background: 'white',
                      color: 'var(--ink)', fontWeight: 700, fontSize: 15, textDecoration: 'none',
                    }}
                  >
                    Demander un devis
                  </a>
                </div>
              </div>

            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', maxWidth: 640, margin: '24px auto 0' }}>
              Prix TTC, sauf la licence Pro (HT). Déjà abonné ? Vous gardez votre prix
              de {euros(legacyPremiumTtc)} par mois tant que vous restez abonné.
            </p>
          </div>
        </section>

        {/* ── Estimer une licence Pro ── */}
        <section className="section" style={{ background: 'var(--beige-2)' }}>
          <div className="container" style={{ maxWidth: 680 }}>
            <h2 className="h2" style={{ marginBottom: 12 }}>Estimez votre licence Pro</h2>
            <p className="p" style={{ marginBottom: 24 }}>
              Indiquez combien de crédits votre équipe consommera par mois : le devis part de là.
            </p>
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label htmlFor="pro-volume" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                Crédits par mois : {credits(volume)}
              </label>
              <input
                id="pro-volume"
                type="range"
                min={pro.includedCredits}
                max={200000}
                step={5000}
                value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                style={{ width: '100%', height: 28, padding: 0, border: 'none', background: 'transparent', appearance: 'auto', accentColor: 'var(--orange)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                  {euros(pro.baseHt)} + {credits(Math.max(0, volume - pro.includedCredits))} × {euros(pro.extraCreditHt)}
                </span>
                <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>{euros(quote)} HT/mois</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Ce que coûte un crédit ── */}
        <section className="section">
          <div className="container" style={{ maxWidth: 680 }}>
            <h2 className="h2" style={{ marginBottom: 16 }}>Ce que coûte un crédit</h2>
            <p className="p" style={{ marginBottom: 20 }}>
              Chaque action de l’IA a un coût réel. Tiroir le répercute simplement, sans publicité
              ni revente de données : <strong>vous payez ce que vous utilisez, nous ne revendons rien</strong>.
            </p>
            <div className="card" style={{ padding: '4px 20px' }}>
              {creditCosts.map((c, i) => (
                <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderTop: i === 0 ? undefined : '1px solid rgba(0,0,0,0.06)' }}>
                  <span style={{ fontSize: 15, color: 'var(--ink)' }}>{c.label}</span>
                  <strong style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{c.credits} {c.credits > 1 ? 'crédits' : 'crédit'}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="section" style={{ background: 'var(--beige-2)' }}>
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
              <h3 className="h2" style={{ color: 'white' }}>{free.aiObjects} objets offerts pour commencer.</h3>
              <p style={{ opacity: 0.85, marginTop: 8 }}>
                Aucune carte bancaire requise. Vos données vous appartiennent.
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
