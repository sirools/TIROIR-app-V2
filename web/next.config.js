// apps/next/next.config.js
const path = require('path')

// Récupère l'host Supabase depuis l'env pour éviter de le hardcoder
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supaHost = SUPABASE_URL.replace(/^https?:\/\//, '').split('/')[0] // ex: wbceaxzvlztmsaklbxdb.supabase.co

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  // Le lint reste dispo via `npm run lint` mais ne bloque pas le build de prod
  // (règles cosmétiques type react/no-unescaped-entities sur du texte FR).
  eslint: { ignoreDuringBuilds: true },

  // pdfkit lit ses métriques de polices (.afm) depuis son paquet au runtime.
  // Le tracing par défaut ne les voit pas (require dynamique) → les inclure
  // explicitement pour la route d'export PDF (sinon 500 sur Vercel).
  experimental: {
    outputFileTracingIncludes: {
      '/api/shares/[token]/export.pdf': ['./node_modules/pdfkit/js/data/**/*'],
      // Le savoir de Clément, lu par Torix côté serveur seulement.
      '/api/torix/ask': ['./components/torix/savoir.md'],
    },
  },

  // i18n natif (Pages Router). FR = défaut sans préfixe (tiroir.app/...),
  // EN préfixé (tiroir.app/en/...). Détection auto désactivée tant que
  // toutes les pages publiques ne sont pas traduites — les liens App Store
  // pointent explicitement vers /en.
  i18n: {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
    localeDetection: false,
  },

  // Autoriser les images distantes (Next/Image)
  images: {
    remotePatterns: [
      // Fichiers du storage Supabase
      ...(supaHost
        ? [{ protocol: 'https', hostname: supaHost, pathname: '/storage/v1/object/**' }]
        : []),
    ],
    // formats: ['image/avif', 'image/webp'], // optionnel
  },

  // En-têtes de sécurité. Aucune page de Tiroir n'a vocation à être intégrée
  // dans le site d'un autre : pas de cadre (clickjacking), et jamais pour le
  // back-office et Torix. HSTS est posé par Vercel sur les domaines.
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
    ]
    const locked = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ]
    return [
      { source: '/:path*', headers: common },
      { source: '/admin', headers: locked },
      { source: '/admin/:path*', headers: locked },
      { source: '/api/admin/:path*', headers: locked },
      { source: '/api/torix/:path*', headers: locked },
    ]
  },

  transpilePackages: [
    'tamagui',
    '@tamagui/web',
    '@tamagui/core',
    '@tamagui/themes',
    '@tamagui/normalize-css',
    '@tamagui/portal',
    '@tamagui/helpers',
  ],

  webpack: (config) => {
    // prefer web extensions first
    config.resolve.extensions = [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      ...config.resolve.extensions,
    ]

    // ensure we resolve from this app's node_modules
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      'node_modules',
      ...(config.resolve.modules || []),
    ]

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // ensure single copies of these
      tamagui: require.resolve('tamagui'),
      '@tamagui/web': require.resolve('@tamagui/web'),

      // your existing aliases
      'app/provider': path.resolve(__dirname, 'stubs/provider.tsx'),
      'app/provider/NextTamaguiProvider': path.resolve(
        __dirname,
        'stubs/NextTamaguiProvider.tsx'
      ),

      // map RN -> RN-web just in case
      'react-native$': 'react-native-web',
    }

    return config
  },
}

module.exports = nextConfig