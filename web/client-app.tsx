// 'use client'

// import 'raf/polyfill'
// import Head from 'next/head'
// import { config } from '@my/ui'
// import { NextTamaguiProvider } from 'app/provider/NextTamaguiProvider'
// import type { SolitoAppProps } from 'solito'

// export default function ClientApp({ Component, pageProps }: SolitoAppProps) {
//   return (
//     <>
//       <Head>
//         <title>Tiroir</title>
//         <meta name="description" content="Tiroir, votre inventaire personnel et intelligent." />
//         <link rel="icon" href="/favicon.ico" />

//         <style
//           dangerouslySetInnerHTML={{
//             __html: config.getNewCSS(),
//           }}
//         />
//         <style
//           dangerouslySetInnerHTML={{
//             __html: config.getCSS({
//               exclude: process.env.NODE_ENV === 'production' ? 'design-system' : null,
//             }),
//           }}
//         />
//         <script
//           dangerouslySetInnerHTML={{
//             __html: `document.documentElement.classList.add('t_unmounted')`,
//           }}
//         />
//       </Head>

//       <NextTamaguiProvider>
//         <Component {...pageProps} />
//       </NextTamaguiProvider>
//     </>
//   )
// }