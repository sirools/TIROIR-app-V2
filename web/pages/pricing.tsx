import Head from 'next/head'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import StoreButtons from '../components/StoreButtons'
import type { GetStaticProps } from 'next'
import { featureLists, fetchPlanQuotas, type PlanQuotas } from '../lib/planQuotas'

// Les quotas affichés sont ceux réellement appliqués : lus dans
// app_settings (onglet Quotas du back-office) par lib/planQuotas.ts, la page
// se régénère toutes les 10 minutes. Ne jamais les réécrire à la main ici.
//
// L'estimation de valeur marchande est la fonction la plus chère de l'app
// (recherche web + modèle) : elle est annoncée avec son propre plafond, pas
// diluée dans les « analyses IA ».
const faq = (q: PlanQuotas) => [
  {
    q: 'Puis-je annuler à tout moment ?',
    a: 'Oui. L\'abonnement se gère depuis les Réglages iOS (Apple ID → Abonnements) sur iPhone, ou depuis le Play Store (menu → Abonnements) sur Android. Aucun engagement, aucun frais après annulation.',
  },
  {
    q: 'Qu\'est-ce qu\'une "analyse IA" ?',
    a: 'Chaque fois que vous photographiez un objet, Tiroir envoie les images à un modèle d\'intelligence artificielle (Claude d\'Anthropic) qui génère automatiquement le titre, la description, la catégorie et les attributs. C\'est cette opération qui consomme un crédit d\'analyse.',
  },
  {
    q: 'Et une "estimation de valeur" ?',
    a: 'C\'est une recherche d\'annonces comparables (leboncoin, Vinted, eBay, Facebook Marketplace) suivie d\'une synthèse par l\'IA, avec les liens vers les annonces trouvées. Elle mobilise une recherche web en plus du modèle, ce qui la rend nettement plus coûteuse qu\'une analyse de photo : elle a donc son propre quota, plus serré.',
  },
  {
    q: 'La version gratuite est-elle vraiment gratuite ?',
    a: `Oui, sans carte bancaire ni engagement. Les ${q.freeObjects} objets et ${q.freeAnalyses} analyses mensuelles suffisent pour découvrir l'application et organiser une collection modeste.`,
  },
  {
    q: 'Quand passer au forfait Professionnel ?',
    a: `Quand l'inventaire devient un outil de travail : brocante, atelier, agence immobilière, expertise ou gestion de parc. Le Professionnel monte les quotas IA à ${q.proAnalyses} analyses et ${q.proEnhances} améliorations photo par mois, et se facture sur facture — sans passer par les stores. Écrivez-nous à hello@tiroir.app, le compte est ouvert sous 48 h.`,
  },
  {
    q: 'Mes données sont-elles supprimées si j\'annule ?',
    a: 'Non. Vos objets et photos restent accessibles en mode gratuit, dans la limite du quota gratuit. Vous pouvez demander la suppression complète à tout moment via support@tiroir.app.',
  },
  {
    q: 'Pourquoi l\'IA est-elle limitée en gratuit ?',
    a: 'Chaque analyse a un coût réel en tokens (infrastructure Anthropic). La version premium finance ce coût et nous permet de maintenir un service de qualité sans publicité ni revente de données.',
  },
  {
    q: 'Comment contacter le support ?',
    a: 'Pour toute question, problème ou demande, écrivez-nous à support@tiroir.app. Nous répondons le plus rapidement possible en fonction des volumes.',
  },
]

export const getStaticProps: GetStaticProps<{ quotas: PlanQuotas }> = async () => {
  const { quotas } = await fetchPlanQuotas()
  return { props: { quotas }, revalidate: 600 }
}

export default function Pricing({ quotas }: { quotas: PlanQuotas }) {
  const { free: FREE_FEATURES, premium: PREMIUM_FEATURES, pro: PRO_FEATURES, highlighted: HIGHLIGHTED } = featureLists(quotas)
  const FAQ = faq(quotas)
  return (
    <>
      <Head>
        <title>Tarifs — Tiroir</title>
        <meta name="description" content={`Un inventaire alimenté par l'IA, gratuit pour commencer. Tiroir Premium à 6,99 €/mois pour des objets illimités et ${quotas.premiumAnalyses} analyses IA par mois, Professionnel à 29 €/mois pour les inventaires métier.`} />
      </Head>

      <HeaderTiroirWeb />

      <main>
        {/* ── Hero ── */}
        <section className="section" style={{ background: 'var(--beige)', textAlign: 'center', paddingBottom: 48 }}>
          <div className="container" style={{ maxWidth: 640 }}>
            <div style={{ display: 'inline-block', background: '#FFE4CC', color: 'var(--orange)', padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
              Tarifs
            </div>
            <h1 className="h1" style={{ marginBottom: 16 }}>Simple et transparent.</h1>
            <p className="p" style={{ fontSize: 18, maxWidth: 520, margin: '0 auto' }}>
              Commencez gratuitement. Passez à Premium quand votre collection le mérite,
              au Professionnel quand c&apos;est votre métier.
            </p>
          </div>
        </section>

        {/* ── Plans ── */}
        <section className="section" style={{ paddingTop: 48 }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(272px, 1fr))', gap: 24, maxWidth: 1080, margin: '0 auto', alignItems: 'stretch' }}>

              {/* Free */}
              <div className="card" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Gratuit</div>
                  <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>0 €</div>
                  <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>Pour découvrir et commencer</div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {FREE_FEATURES.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--ink)' }}>
                      <CheckIcon /> {f}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <StoreButtons variant="card" full />
                </div>
              </div>

              {/* Premium */}
              <div className="card" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20, border: '2px solid var(--orange)', position: 'relative', overflow: 'visible' }}>
                <div style={{ position: 'absolute', top: -14, left: 28, background: 'var(--orange)', color: 'white', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 999 }}>
                  Recommandé
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Premium</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 42, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>6,99 €</span>
                    <span style={{ fontSize: 15, color: 'var(--muted)' }}>/mois</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>ou 59,99 € /an — soit 5 € /mois</div>
                  <div style={{ fontSize: 13, color: 'var(--orange)', fontWeight: 600, marginTop: 8 }}>✦ 7 jours d'essai gratuit</div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {PREMIUM_FEATURES.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--ink)', fontWeight: HIGHLIGHTED.has(f) ? 600 : 400 }}>
                      <CheckIcon orange /> {f}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>
                    7 jours d'essai gratuit, sur les deux stores
                  </div>
                  <StoreButtons variant="cardPrimary" full />
                </div>
              </div>

              {/* Professionnel — vendu en direct, pas via les stores */}
              <div className="card" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Professionnel</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 42, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>29 €</span>
                    <span style={{ fontSize: 15, color: 'var(--muted)' }}>/mois</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>ou 290 € /an — 2 mois offerts</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginTop: 8 }}>Brocante, atelier, agence, expertise</div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {PRO_FEATURES.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--ink)', fontWeight: HIGHLIGHTED.has(f) ? 600 : 400 }}>
                      <CheckIcon /> {f}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>
                    Ouverture de compte sous 48 h
                  </div>
                  <a
                    href="mailto:hello@tiroir.app?subject=Forfait%20Professionnel%20Tiroir"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '13px 16px', borderRadius: 12, border: '1.5px solid var(--ink)',
                      color: 'var(--ink)', fontWeight: 700, fontSize: 15, textDecoration: 'none',
                    }}
                  >
                    Nous contacter
                  </a>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Pourquoi ça coûte ── */}
        <section className="section" style={{ background: 'var(--beige-2)' }}>
          <div className="container" style={{ maxWidth: 680 }}>
            <h2 className="h2" style={{ marginBottom: 16 }}>Pourquoi l'IA a un coût ?</h2>
            <p className="p" style={{ marginBottom: 16 }}>
              Chaque photo que vous analysez est traitée par <strong>Claude d'Anthropic</strong>, un modèle d'IA avancé. Ce traitement consomme des ressources de calcul facturées à la requête — ce qu'on appelle des <em>tokens</em>.
            </p>
            <p className="p" style={{ marginBottom: 16 }}>
              Contrairement à d'autres applications qui monétisent vos données ou diffusent de la publicité, Tiroir choisit un modèle direct : <strong>vous payez pour ce que vous utilisez, nous ne revendons rien</strong>.
            </p>
            <p className="p">
              Le plan gratuit couvre {quotas.freeAnalyses} analyses par mois — suffisant pour découvrir l'app et commencer à organiser une collection. Le Premium finance la totalité du coût IA et nous permet d'améliorer le service en continu. Le Professionnel, vendu en direct sans commission de store, couvre les volumes d'un usage métier.
            </p>
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
              <h3 className="h2" style={{ color: 'white' }}>7 jours pour vous faire votre avis.</h3>
              <p style={{ opacity: 0.85, marginTop: 8 }}>
                Aucune carte bancaire requise pour commencer. Annulable à tout moment.
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

function CheckIcon({ orange }: { orange?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill={orange ? '#FFF0E6' : '#F4F4F2'} />
      <path d="M5 8l2 2 4-4" stroke={orange ? 'var(--orange)' : '#888'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
