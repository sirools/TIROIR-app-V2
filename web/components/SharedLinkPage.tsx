// apps/next/components/SharedLinkPage.tsx
'use client'

import Head from 'next/head'
import { YStack, XStack, Text, Separator } from 'tamagui'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import type { ObjectCardProps } from '../../../features/objects/components/ObjectCard'

const ObjectCard = dynamic<React.FC<ObjectCardProps>>(
  () => import('../../../features/objects/components/ObjectCard').then(m => m.ObjectCard ?? m.default),
  { ssr: false }
)

function SharedLinkPage({ sharedLink, objetsPartages = [], slug, gated }: any) {
  const router = useRouter()

  if (gated) {
    return (
      <YStack minHeight="100vh" bg="$background">
        <Head><meta name="robots" content="noindex,nofollow" /></Head>
        <Text>Formulaire mot de passe ici…</Text>
      </YStack>
    )
  }

  return (
    <YStack minHeight="100vh" bg="$background">
      <Head><meta name="robots" content="noindex,nofollow" /></Head>
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$6" fontWeight="700">Objets partagés</Text>
      </XStack>
      <Separator />
      <XStack gap="$4" flexWrap="wrap">
        {objetsPartages.map((obj: any) => (
          <ObjectCard
            key={obj.id}
            title={obj.title}
            imageUrl={obj.image_urls?.[0] ?? ''}
            description={obj.description}
            status={obj.status}
            date={obj.created_at}
            zoom="detailed"
            style={{ width: 280 }}
            onPress={() => router.push(`/share/o/${slug}/${obj.id}`)}
            visibleFields={['title', 'image', 'status']}
          />
        ))}
      </XStack>
    </YStack>
  )
}

export default SharedLinkPage

// 👇 tu exportes aussi getServerSideProps depuis ici
export { getServerSideProps } from '../pages/share/[slug].data'