// HeaderTiroirWeb.tsx (version HTML/CSS, sans Tamagui)
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'

type Props = { onJoin?: () => void }

export default function HeaderTiroirWeb({ onJoin }: Props) {
  const router = useRouter()
  return (
    <>
      <header className="ti-header">
        <div className="ti-header__inner">
          {/* Logo */}
          <Link href="/" legacyBehavior passHref>
            <a className="ti-logo">
              <div className="ti-logo__box">T</div>
              <strong className="ti-logo__text">Tiroir</strong>
            </a>
          </Link>

          {/* CTAs à droite */}
          <nav className="ti-nav">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onJoin}
            >
              Beta
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => router.push('/login')}
            >
              Se connecter
            </button>
          </nav>
        </div>
        <div className="ti-header__divider" />
      </header>

      <style jsx>{`
        .ti-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: var(--background, #fff);
        }
        .ti-header__inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 64px;
          max-width: var(--max, 1440px);
          padding: 0 16px;
          margin: 0 auto;
        }
        .ti-header__divider {
          height: 1px;
          background: rgba(0,0,0,0.08);
        }
        .ti-logo {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
        }
        .ti-logo__box {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--orange, #F26900);
          color: white;
          display: grid;
          place-items: center;
          font-weight: 800;
        }
        .ti-logo__text {
          font-weight: 800;
          font-size: 20px;
          color: var(--ink, #121212);
        }
        .ti-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        /* réutilise tes classes boutons globales */
        .btn {
          display:inline-flex;
          gap:10px;
          align-items:center;
          justify-content:center;
          padding: 12px 16px;
          border-radius: 12px;
          font-weight: 700;
          border: 0;
          cursor: pointer;
        }
        .btn-primary {
          background: var(--orange, #F26900);
          color: #fff;
          box-shadow: var(--shadow, 0 6px 20px rgba(0,0,0,0.06));
        }
        .btn-primary:hover { background: var(--orange-700, #D85E00); }
        .btn-secondary {
          background: #fff;
          color: var(--ink, #121212);
          border: 1px solid rgba(0,0,0,0.10);
          box-shadow: var(--shadow, 0 6px 20px rgba(0,0,0,0.06));
        }
      `}</style>
    </>
  )
}



// // apps/next/components/layout/HeaderTiroirWeb.tsx
// import Link from 'next/link'
// import { YStack, XStack, Text, Separator, Button, ThemeableStack } from 'tamagui'
// import { useRouter } from 'next/router'

// type Props = { onJoin?: () => void }

// export default function HeaderTiroirWeb({ onJoin }: Props) {
//   const router = useRouter()
//   return (
//     <YStack
//       w="100%"
//       // pos="sticky"  ❌ Tamagui doesn't type "sticky"
//       // t={0}
//       // zi={50}
//       // pb={8}
//       style={{ position: 'sticky', top: 0, zIndex: 50, paddingBottom: 8, background: 'var(--beige-2)' }}
//     >
//       <XStack ai="center" jc="space-between" w="100%" h={64} px="$4" mx="auto" maw={1120}>
//         {/* Logo */}
//         <Link href="/" legacyBehavior passHref>
//           <a style={{ textDecoration: 'none' }}>
//             <XStack ai="center" gap="$2">
//               <ThemeableStack w={32} h={32} br="$4" bg="$orange10" ai="center" jc="center">
//                 <Text color="white" fontWeight="800">T</Text>
//               </ThemeableStack>
//               <Text fontWeight="800" fontSize="$6" color="$color">Tiroir</Text>
//             </XStack>
//           </a>
//         </Link>

//         {/* Actions (Beta secondary, Se connecter primary) */}
//         <XStack ai="center" gap="$2">
//           <Link href="#features" legacyBehavior passHref>
//             <a style={{ textDecoration: 'none' }}>
//               <Button size="$3" variant="outlined" borderRadius="$4">
//                 Beta
//               </Button>
//             </a>
//           </Link>

//           <Button
//             size="$3"
//             borderRadius="$4"
//             bg="$orange10"
//             color="white"
//             pressStyle={{ bg: '$orange9' }}
//             hoverStyle={{ bg: '$orange9' }}
//             onPress={() => router.push('/login')}
//           >
//             Se connecter
//           </Button>
//         </XStack>
//       </XStack>

//       <Separator borderBottomWidth={1} borderColor="$gray6" />
//     </YStack>
//   )
// }