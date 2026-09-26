import React, { useEffect, useState } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { User } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { Colors, Typography } from './tokens'

interface Props {
  size: number
  /** Chemin de la photo dans object-images (profiles.avatar_path). */
  avatarPath: string | null | undefined
  displayName: string | null | undefined
  /** Aperçu local, affiché pendant l'envoi pour ne pas attendre la
   *  signature d'URL. */
  localUri?: string | null
}

/**
 * Photo de profil. À défaut, l'initiale du nom ; à défaut du nom, une
 * silhouette.
 */
/** URL signée (1 h) d'une photo du bucket privé object-images. */
export function useSignedAvatarUrl(avatarPath: string | null | undefined): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  useEffect(() => {
    setSignedUrl(null)
    if (!avatarPath) return
    let cancelled = false
    supabase.storage.from('object-images')
      .createSignedUrl(avatarPath, 3600)
      .then(({ data }) => { if (!cancelled) setSignedUrl(data?.signedUrl ?? null) })
    return () => { cancelled = true }
  }, [avatarPath])

  return signedUrl
}

export function UserAvatar({ size, avatarPath, displayName, localUri }: Props) {
  const signedUrl = useSignedAvatarUrl(avatarPath)

  const frame = { width: size, height: size, borderRadius: size / 2 }
  const uri = localUri ?? (avatarPath ? signedUrl : null)

  if (uri) {
    return <Image source={{ uri }} style={[styles.base, frame]} resizeMode="cover" />
  }

  const initial = displayName?.trim().charAt(0).toUpperCase()
  return (
    <View style={[styles.base, frame]}>
      {initial
        ? <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
        : <User size={size * 0.45} color={Colors.accent} strokeWidth={1.5} />}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.accentLight,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontWeight: Typography.bold, color: Colors.accent },
})
