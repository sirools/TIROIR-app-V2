// components/share/SignupModalStub.tsx — emplacement de la future modale de
// création de compte Tiroir, pour un visiteur sans compte qui veut suggérer.
//
// TODO(v4-suggestions) : implémenter l'inscription dans la modale (création
// de compte, confirmation, retour direct au formulaire de suggestion). Hors
// périmètre de cette étape : on se contente d'expliquer et de renvoyer vers
// la connexion existante, qui ramène ensuite sur ce partage.
import Link from 'next/link'

export default function SignupModalStub({ token, onClose }: { token: string; onClose: () => void }) {
  const next = encodeURIComponent(`/s/${token}`)
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="signup-title" onClick={e => e.stopPropagation()} data-todo="signup-modal">
        <button type="button" className="close" onClick={onClose} aria-label="Fermer">×</button>
        <div className="icon" aria-hidden>🎁</div>
        <h2 id="signup-title" className="heading">Crée ton compte Tiroir</h2>
        <p className="text">
          Pour suggérer un objet, il faut un compte Tiroir : le propriétaire verra
          qui lui fait la suggestion.
        </p>
        <p className="soon">La création de compte depuis cette fenêtre arrive bientôt.</p>
        <Link href={`/login?next=${next}`} legacyBehavior passHref>
          <a className="primary">J’ai déjà un compte</a>
        </Link>
        <button type="button" className="secondary" onClick={onClose}>Plus tard</button>
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .close {
          position: absolute; top: 10px; right: 14px;
          background: none; border: 0; font-size: 26px; color: #A89F96; cursor: pointer;
        }
        .icon { font-size: 40px; }
        .heading { font-size: 20px; font-weight: 800; color: #1A1612; margin: 0; }
        .text { font-size: 14px; color: #6B6158; line-height: 1.5; margin: 0; }
        .soon { font-size: 12px; color: #A89F96; margin: 0 0 8px; }
        .primary {
          display: block; padding: 13px 20px; border-radius: 999px;
          background: #F26900; color: #fff; font-weight: 700; font-size: 15px; text-decoration: none;
        }
        .secondary { background: none; border: 0; color: #6B6158; font-weight: 600; font-size: 14px; cursor: pointer; padding: 8px; }
      `}</style>
    </div>
  )
}
