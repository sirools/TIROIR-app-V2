// Le ton suit le profil (features/profile/userProfile.ts) : tutoiement pour
// « Pour moi », vouvoiement pour une activité de créatif ou une entreprise.
//
// Un texte qui existe aux deux tons a son double sous « formal », au même
// chemin (design/i18n/app : formal.home.loading pour home.loading). Sans
// double, le texte commun est rendu : la bascule se fait écran par écran,
// en remplaçant `t` par `tt` là où un double existe.
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/AuthContext'
import { toneOf, type Tone } from '@/features/profile/userProfile'

export function useTone(): Tone {
  const { profile } = useAuth()
  return toneOf(profile?.user_profile)
}

/** `tt('home.loading')` : le texte au ton du profil (repli sur le texte commun). */
export function useToneT() {
  const { t } = useTranslation()
  const tone = useTone()
  return useCallback(
    (key: string, options: Record<string, string | number> = {}): string =>
      tone === 'vous' ? t([`formal.${key}`, key], options) : t(key, options),
    [t, tone],
  )
}
