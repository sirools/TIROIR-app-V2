import { useRouter } from 'next/router'
import StoreButtons from '../StoreButtons'

export default function FinalCTA() {
  const { locale } = useRouter()
  const isEn = locale === 'en'
  return (
    <section className="section">
      <div className="container">
        <div className="cta-final">
          <h3 className="h2" style={{ color: 'white' }}>
            {isEn ? 'Your personal inventory, finally simple.' : 'Votre inventaire personnel, enfin simple.'}
          </h3>
          <p style={{ opacity: 0.85, marginTop: 8 }}>
            {isEn
              ? 'Free on iPhone and Android. No sign-up required to get started.'
              : 'Disponible gratuitement sur iPhone et Android. Aucune inscription requise pour commencer.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <StoreButtons isEn={isEn} variant="onColor" />
          </div>
        </div>
      </div>
    </section>
  )
}
