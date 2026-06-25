// apps/next/next.config.js
const path = require('path')

// Récupère l'host Supabase depuis l'env pour éviter de le hardcoder
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supaHost = SUPABASE_URL.replace(/^https?:\/\//, '').split('/')[0] // ex: wbceaxzvlztmsaklbxdb.supabase.co

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },

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