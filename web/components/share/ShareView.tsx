'use client'

import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { YStack, XStack, Text, Separator } from 'tamagui'
import HeaderTiroirWeb from '../../components/layout/HeaderTiroirWeb'

function PasswordForm({ slug }: { slug: string }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault?.()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/shares/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password }),
      })
      if (res.ok) { window.location.href = `/share/${slug}`; return }
      if (res.status === 401) setError('Mot de passe incorrect. Réessaie.')
      else if (res.status === 404) setError('Ce lien de partage est introuvable.')
      else if (res.status === 410) setError('Ce lien a expiré.')
      else setError("Une erreur est survenue. Réessaie plus tard.")
    } catch {
      setError("Impossible d'atteindre le serveur.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <YStack space="$3" maxWidth={420} mx="auto" my="$8">
        <XStack gap="$2" ai="center">
          <input
            name="password"
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)' }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--orange, #F26900)', color: 'white', border: 0, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '...' : 'Valider'}
          </button>
        </XStack>
        {error && <Text color="$red10" fontWeight="600">{error}</Text>}
      </YStack>
    </form>
  )
}

// Carte objet inline (remplace ObjectCard du monorepo V1)
function ObjectCard({ obj, slug }: { obj: any; slug: string }) {
  const router = useRouter()
  const imageUrl = obj.image_urls?.[0] ?? ''
  return (
    <div
      onClick={() => router.push(`/share/o/${slug}/${obj.id}`)}
      style={{ width: 260, cursor: 'pointer', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', background: '#fff' }}
    >
      {imageUrl
        ? <img src={imageUrl} alt={obj.title} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: '100%', aspectRatio: '1', background: 'var(--border-light)', display: 'grid', placeItems: 'center', fontSize: 40 }}>📦</div>
      }
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>{obj.title}</div>
        {obj.status && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{obj.status}</div>}
        {obj.description && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {obj.description}
          </div>
        )}
      </div>
    </div>
  )
}

type Props = {
  sharedLink?: any
  objetsPartages?: any[]
  slug: string
  gated: boolean
}

export default function ShareView({ sharedLink, objetsPartages = [], slug, gated }: Props) {
  if (gated) {
    return (
      <YStack minHeight="100vh" bg="$background">
        <Head><meta name="robots" content="noindex,nofollow" /></Head>
        <HeaderTiroirWeb />
        <YStack px="$4" py="$6" width="100%" maxWidth={1440} marginHorizontal="auto">
          <PasswordForm slug={slug} />
        </YStack>
      </YStack>
    )
  }

  const totalValue = objetsPartages.reduce((sum: number, obj: any) => {
    const rawValue = obj.characteristics?.['Valeur'] ?? ''
    const numeric = parseFloat(rawValue.toString().replace(/[^\d.,]/g, '').replace(',', '.'))
    return sum + (isNaN(numeric) ? 0 : numeric)
  }, 0)

  return (
    <YStack minHeight="100vh" bg="$background">
      <Head><meta name="robots" content="noindex,nofollow" /></Head>
      <HeaderTiroirWeb />
      <YStack px="$4" py="$6" width="100%" maxWidth={1440} marginHorizontal="auto" space="$6">
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap">
          <Text fontSize="$6" fontWeight="700">Objets partagés</Text>
          {totalValue > 0 && (
            <Text fontSize="$6" fontWeight="600" color="$primary">
              {totalValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€ au total
            </Text>
          )}
        </XStack>

        <Separator borderColor="$border" />

        <XStack gap="$4" flexWrap="wrap">
          {objetsPartages.map((obj: any) => (
            <ObjectCard key={obj.id} obj={obj} slug={slug} />
          ))}
        </XStack>
      </YStack>
    </YStack>
  )
}
