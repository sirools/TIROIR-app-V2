// La question de l'onboarding (lib/userProfile.ts) : « Tu utilises
// Tiroir… », trois réponses, un tap. Le choix s'enregistre aussitôt dans
// profiles.user_profile ; il ne déclenche aucun paiement. Servie après la
// sauvegarde du premier objet (/essai/sauvegarde), sur l'accueil tant
// qu'elle n'a pas de réponse, et dans « Profil » pour changer d'avis.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toned, toneOf, USER_PROFILES, type UserProfile } from '../../lib/userProfile'
import { useCopy } from '../../locales'

type Props = {
  userId: string
  /** Réponse actuelle (page Profil), ou null tant que la question est ouverte. */
  value?: UserProfile | null
  onSaved: (profile: UserProfile) => void
}

const ICONS: Record<UserProfile, string> = { personal: '🏠', creative: '🎬', business: '🏢' }

export default function ProfileTypeChoice({ userId, value = null, onSaved }: Props) {
  const { t: { inventory: { profileType } } } = useCopy()
  // La question se pose au tutoiement ; une fois un profil pro choisi, au vouvoiement.
  const t = toned(profileType, toneOf(value))
  const [saving, setSaving] = useState<UserProfile | null>(null)
  const [failed, setFailed] = useState(false)

  async function choose(profile: UserProfile) {
    if (saving || profile === value) return
    setSaving(profile)
    setFailed(false)
    const { error } = await supabase.from('profiles').update({ user_profile: profile }).eq('id', userId)
    setSaving(null)
    if (error) {
      setFailed(true)
      return
    }
    onSaved(profile)
  }

  return (
    <div>
      <div className="options" role="group" aria-label={t.settingsLabel}>
        {USER_PROFILES.map(p => (
          <button
            key={p} type="button" className="option" aria-pressed={value === p}
            disabled={saving !== null} onClick={() => choose(p)}
          >
            <span className="icon" aria-hidden="true">{ICONS[p]}</span>
            <span className="text">
              <span className="label">{saving === p ? t.saving : t.options[p].label}</span>
              <span className="hint">{t.options[p].hint}</span>
            </span>
          </button>
        ))}
      </div>
      <div role="status" aria-live="polite">{failed && <p className="failed">{t.saveFailed}</p>}</div>
      <p className="note">{t.noPayment}</p>
      <style jsx>{`
        .options { display: grid; gap: 10px; }
        .option { display: flex; align-items: center; gap: 14px; width: 100%; min-height: 68px; padding: 12px 16px; border-radius: 14px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
        .option:hover:not(:disabled) { border-color: var(--orange); }
        .option[aria-pressed='true'] { border-color: var(--orange); background: var(--beige); }
        .option:disabled { opacity: 0.6; cursor: default; }
        .option:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        .icon { font-size: 26px; flex-shrink: 0; }
        .text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .label { font-size: 16px; font-weight: 700; }
        .hint { font-size: 13px; line-height: 1.4; color: var(--muted); }
        .failed { margin: 10px 0 0; font-size: 14px; color: var(--error); }
        .note { margin: 12px 0 0; font-size: 12px; line-height: 1.45; color: var(--muted); }
      `}</style>
    </div>
  )
}
