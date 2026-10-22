// components/share/SignupModal.tsx — un visiteur sans compte veut suggérer
// un objet sur un partage dont le propriétaire accepte les suggestions.
//
// On explique pourquoi il faut un compte, puis deux portes : le créer, ou se
// connecter. Les deux ramènent sur ce partage avec le formulaire rouvert
// (?suggerer=1, voir lib/authFlow.ts), même après l'e-mail de confirmation.
import Link from 'next/link'
import { authHref, shareReturnPath } from '../../lib/authFlow'
import { useCopy } from '../../locales'

export default function SignupModal({ token, onClose }: { token: string; onClose: () => void }) {
  const { t: { share: { signup: t, common } } } = useCopy()
  const back = shareReturnPath(token)
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="signup-title" onClick={e => e.stopPropagation()} data-modal="signup">
        <button type="button" className="close" onClick={onClose} aria-label={common.close}>×</button>
        <div className="icon" aria-hidden>🎁</div>
        <h2 id="signup-title" className="heading">{t.title}</h2>
        <p className="text">{t.text}</p>
        <p className="soon">{t.soon}</p>
        <Link href={authHref('/inscription', back)} legacyBehavior passHref>
          <a className="primary">{t.create}</a>
        </Link>
        <Link href={authHref('/login', back)} legacyBehavior passHref>
          <a className="ghost">{t.haveAccount}</a>
        </Link>
        <button type="button" className="secondary" onClick={onClose}>{t.later}</button>
      </div>
      <style jsx>{`
        .backdrop {
          position: fixed; inset: 0; z-index: 50;
          background: rgba(26, 22, 18, 0.45);
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .sheet {
          position: relative; width: 100%; max-width: 380px;
          background: #fff; border-radius: 20px; padding: 32px 24px 24px;
          text-align: center; display: flex; flex-direction: column; gap: 10px;
          font-family: var(--font-body);
        }
        .close {
          position: absolute; top: 10px; right: 14px;
          background: none; border: 0; font-size: 26px; color: var(--text-tertiary); cursor: pointer;
        }
        .icon { font-size: 40px; }
        .heading { font-size: 20px; font-weight: 800; color: var(--ink); margin: 0; }
        .text { font-size: 14px; color: var(--muted); line-height: 1.5; margin: 0; }
        .soon { font-size: 12px; color: var(--text-tertiary); margin: 0 0 8px; }
        .primary {
          display: block; padding: 13px 20px; border-radius: 999px;
          background: #F26900; color: #fff; font-weight: 700; font-size: 15px; text-decoration: none;
        }
        .ghost {
          display: block; padding: 12px 20px; border-radius: 999px;
          border: 1px solid rgba(26, 22, 18, 0.14); color: var(--ink);
          font-weight: 700; font-size: 15px; text-decoration: none;
        }
        .secondary { background: none; border: 0; color: var(--muted); font-weight: 600; font-size: 14px; cursor: pointer; padding: 8px; }
      `}</style>
    </div>
  )
}
