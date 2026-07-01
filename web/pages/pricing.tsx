import Head from 'next/head'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'

const FREE_FEATURES = [
  '30 objets',
  '30 analyses IA / mois',
  '1 photo par objet',
  'Collections & recherche',
  'Partage par lien',
  'Valeur marché estimée',
]

const PREMIUM_FEATURES = [
  'Objets illimités',
  '150 analyses IA / mois',
  'Photos multiples par objet',
  '50 améliorations photo IA / mois',
  'Collections & recherche',
  'Partage par lien',
  'Valeur marché estimée',
  'Toutes les futures fonctionnalités',
]

const FAQ = [
  {
    q: 'Puis-je annuler à tout moment ?',
    a: 'Oui. L\'abonnement se gère directement depuis les Réglages iOS → Apple ID → Abonnements. Aucun engagement, aucun frais après annulation.',
  },
  {
    q: 'Qu\'est-ce qu\'une "analyse IA" ?',
    a: 'Chaque fois que vous photographiez un objet, Tiroir envoie les images à un modèle d\'intelligence artificielle (Claude d\'Anthropic) qui génère automatiquement le titre, la description, la catégorie et les attributs. C\'est cette opération qui consomme un crédit d\'analyse.',
  },
  {
    q: 'La version gratuite est-elle vraiment gratuite ?',
    a: 'Oui, sans carte bancaire ni engagement. Les 30 objets et 30 analyses mensuelles suffisent pour découvrir l\'application et organiser une collection modeste.',
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

export default function Pricing() {
  return (
    <>
      <Head>
        <title>Tarifs — Tiroir</title>
        <meta name="description" content="Un inventaire personnel alimenté par l'IA, gratuit pour commencer. Tiroir Premium à 6,99 €/mois pour 150 analyses IA par mois et des objets illimités." />
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
            <p className="p" style={{ fontSize: 18, maxWidth: 480, margin: '0 auto' }}>
              Commencez gratuitement. Passez à Premium quand votre collection le mérite.
            </p>
          </div>
        </section>

        {/* ── Plans ── */}
        <section className="section" style={{ paddingTop: 48 }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, maxWidth: 760, margin: '0 auto' }}>

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
                <a
                  href="https://apps.apple.com/app/id6751784101"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ background: 'white', border: '1.5px solid rgba(0,0,0,0.12)', color: 'var(--ink)', textDecoration: 'none', width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                >
                  Télécharger gratuitement
                </a>
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
                  <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>ou 59,99 € /an — 2 mois offerts</div>
                  <div style={{ fontSize: 13, color: 'var(--orange)', fontWeight: 600, marginTop: 8 }}>✦ 7 jours d'essai gratuit</div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {PREMIUM_FEATURES.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--ink)', fontWeight: f === 'Objets illimités' || f === '150 analyses IA / mois' || f === '50 améliorations photo IA / mois' ? 600 : 400 }}>
                      <CheckIcon orange /> {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="https://apps.apple.com/app/id6751784101"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                >
                  Essayer 7 jours gratuits
                </a>
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
              Le plan gratuit couvre 30 analyses par mois — suffisant pour découvrir l'app et commencer à organiser une collection. Le Premium finance la totalité du coût IA et nous permet d'améliorer le service en continu.
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
              <a
                href="https://apps.apple.com/app/id6751784101"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'white', color: 'var(--orange)', padding: '12px 24px', borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none', marginTop: 16 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Télécharger sur l'App Store
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: 'var(--orange)', borderRadius: 8 }} />
            <span>© {new Date().getFullYear()} Tiroir</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="mailto:hello@tiroir.app">Contact</a>
            <a href="/privacy">Confidentialité</a>
          </div>
        </div>
      </footer>
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
