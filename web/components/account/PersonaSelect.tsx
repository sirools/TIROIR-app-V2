// Le choix du profil (web/lib/personas.ts), rangé par familles : à
// l'inscription, sur l'accueil tant qu'il n'est pas fait, et dans
// « Profil ». Un profil de santé affiche le contact de l'offre Business :
// aucun inventaire lié à des patients n'a sa place dans Tiroir aujourd'hui.
import type { CSSProperties } from 'react'
import { CONTACT_EMAIL } from '../legal/contacts'
import { needsBusinessContact, PERSONA_FAMILIES } from '../../lib/personas'
import { useCopy } from '../../locales'

type Props = {
  id: string
  value: string
  onChange: (value: string) => void
  /** Style du champ, pour se fondre dans le formulaire qui l'accueille. */
  style?: CSSProperties
  className?: string
}

export default function PersonaSelect({ id, value, onChange, style, className }: Props) {
  const { t: { inventory: { persona: t } } } = useCopy()
  return (
    <>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} style={style} className={className}>
        <option value="">{t.placeholder}</option>
        {PERSONA_FAMILIES.map(family => (
          family.personas.length === 1 ? (
            <option key={family.key} value={family.personas[0]}>{t.names[family.personas[0]]}</option>
          ) : (
            <optgroup key={family.key} label={t.families[family.key]}>
              {family.personas.map(p => <option key={p} value={p}>{t.names[p]}</option>)}
            </optgroup>
          )
        ))}
      </select>
      {needsBusinessContact(value) && (
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.45, color: 'var(--muted)' }}>
          {t.healthNote}{' '}
          <a href={`mailto:${CONTACT_EMAIL}?subject=Tiroir%20Business`} style={{ color: 'var(--orange-700)', fontWeight: 600 }}>
            {t.healthContact}
          </a>
        </p>
      )}
    </>
  )
}
