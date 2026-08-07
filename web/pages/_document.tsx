// apps/next/pages/_document.tsx
import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document'

export default class MyDocument extends Document<{ locale: string }> {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps & { locale: string }> {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps, locale: ctx.locale ?? 'fr' }
  }

  render() {
    return (
      <Html lang={this.props.locale}>
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

          {/* Favicon. Le .ico embarque 16 → 256 px : les onglets, la barre
              des tâches et les raccourcis ne piochent pas la même taille,
              et un .ico à résolution unique se fait redimensionner par le
              système, qui le fait mal. Le SVG passe devant quand le
              navigateur le sait — il reste net à toutes les densités. */}
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="icon" href="/logo-tiroir.svg" type="image/svg+xml" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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