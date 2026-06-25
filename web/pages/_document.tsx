// apps/next/pages/_document.tsx
import Document, { Html, Head, Main, NextScript } from 'next/document'

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="fr">
        <Head>
          {/* Resource Hints */}
          <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
          <link rel="dns-prefetch" href="https://fonts.gstatic.com" />

          {/* Preconnects (avec CORS) */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

          {/* Google Fonts (Inter) */}
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
            rel="stylesheet"
          />

          {/* Métadonnées de base */}
          <meta name="theme-color" content="#F26900" />
          <meta name="color-scheme" content="light dark" />

          {/* Favicon / PWA (optionnel, mets tes fichiers si dispo) */}
          {/* <link rel="icon" href="/favicon.ico" /> */}
          {/* <link rel="apple-touch-icon" href="/apple-touch-icon.png" /> */}
          {/* <link rel="manifest" href="/manifest.webmanifest" /> */}
        </Head>
        <body>
          {/* Pas de Tamagui ici */}
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}