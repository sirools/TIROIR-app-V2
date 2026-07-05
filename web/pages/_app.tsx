// apps/next/pages/_app.tsx
'use client'

import type { AppProps } from 'next/app'
import '@tamagui/core/reset.css'
import { TamaguiProvider } from 'tamagui'
import config from '../tamagui.config'
import SiteVisitTracker from '../components/SiteVisitTracker'

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <SiteVisitTracker />
      <Component {...pageProps} />

      <style jsx global>{`
        :root {
          --font-body: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          --beige: #FFF4E6;
          --beige-2: #FFF8EF;
          --orange: #F26900;
          --orange-700: #D85E00;
          --ink: #121212;
          --muted: #5b5b5b;
          --radius: 16px;
          --shadow: 0 6px 20px rgba(0,0,0,0.06);
          --max: 1440px;
        }

        a.btn,
        a.button {
          text-decoration: none;
        }

        html { font-family: var(--font-body); scroll-behavior: smooth; }
        body { font-family: inherit; margin: 0; background-color: white; }
        button, input, textarea, select, .h1, .h2, .p,
        h1, h2, h3, h4, h5, h6, p { font-family: inherit; }
        section[id] { scroll-margin-top: 80px; }

        .hero {
          padding: clamp(40px, 6vw, 80px) 0;
          background: radial-gradient(65% 65% at 80% 0%, rgba(242,105,0,0.10), transparent), var(--beige);
        }
        .hero-grid {
          display: grid;
          align-items: center;
          gap: clamp(20px, 3vw, 40px);
          grid-template-columns: 1fr;
        }
        @media (min-width: 1000px) {
          .hero-grid { grid-template-columns: 1.15fr 0.85fr; }
        }
        .hero-copy { max-width: 640px; }
        .hero-ctas { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
        .btn-secondary {
          background: white; color: var(--ink);
          border: 1px solid rgba(0,0,0,0.10);
          box-shadow: var(--shadow);
        }
        .hero-visual {
          position: relative;
          aspect-ratio: 4 / 5;
          max-width: 600px;
          width: 100%;
          justify-self: center;
          border-radius: 20px;
          overflow: hidden;
        }
        @media (min-width: 1000px) {
          .hero-visual { justify-self: end; }
        }
        .hero-visual img { object-fit: contain !important; }

        .badge {
          display:inline-block; background:#FFE4CC; color:#7a3a00;
          padding:6px 10px; border-radius:999px; font-weight:600; font-size:13px;
          margin-bottom: 12px;
        }

        .container { max-width: var(--max); margin: 0 auto; padding: 0 16px; }
        .section { padding: 64px 0; }
        .grid-2 { display: grid; gap: 32px; grid-template-columns: 1fr; }
        @media (min-width: 900px) { .grid-2 { grid-template-columns: 1.1fr 0.9fr; } }

        .h1 { font-size: clamp(28px, 4vw, 48px); line-height: 1.1; font-weight: 800; color: var(--ink); }
        .h2 { font-size: clamp(22px, 3vw, 32px); font-weight: 800; color: var(--ink); }
        .p { color: var(--muted); font-size: 16px; line-height: 1.6; }

        .btn {
          display:inline-flex; gap:10px; align-items:center; justify-content:center;
          padding:14px 20px; border-radius: 12px; font-weight: 700; border: 0; cursor: pointer;
        }
        .btn-primary { background: var(--orange); color: white; box-shadow: var(--shadow); }
        .btn-primary:hover { background: var(--orange-700); }

        .card {
          background: white; border-radius: var(--radius); box-shadow: var(--shadow);
          border: 1px solid rgba(0,0,0,0.06);
        }

        .mock { border-radius: 20px; overflow: hidden; border:1px solid rgba(0,0,0,0.06); }

        .grid-cards { display:grid; gap:16px; grid-template-columns: 1fr; }
        @media (min-width: 800px) { .grid-cards { grid-template-columns: 1fr 1fr; } }

        .usecases-desktop { display:none; }
        .usecases-scroll { display:flex; gap:16px; overflow-x:auto; scroll-snap-type:x mandatory; padding-bottom: 8px; }
        .usecases-item { min-width: 82%; scroll-snap-align:center; }
        @media (min-width: 900px) {
          .usecases-desktop { display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; }
          .usecases-scroll { display:none; }
        }

        .cta-final { background: var(--orange); color: white; border-radius: 20px; padding:80px 24px; text-align:center; box-shadow: var(--shadow); }
        .footer { background: var(--beige-2); padding: 28px 0; color:#555; }


        /* --- Restore base typography after Tamagui reset ------------------------ */
        p { 
          display: block;
          margin: 0.5rem 0 0.75rem;       /* re-marges paragraphe */
          line-height: 1.6;
        }

        ul {
          margin: 0.5rem 0 0.75rem;
          padding-left: 1.25rem;          /* indentation liste */
          list-style: disc;
        }
        ul li {
          display: list-item;             /* re-force l’affichage en bloc */
          margin: 0.25rem 0;
        }

        h1, h2, h3, h4, h5, h6 {
          margin: 0.5rem 0 0.5rem;        /* titres respirent un peu */
          line-height: 1.2;
        }
      `}</style>
    </TamaguiProvider>
  )
}
