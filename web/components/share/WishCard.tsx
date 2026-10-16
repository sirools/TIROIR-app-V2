// components/share/WishCard.tsx — carte « fantôme » d'une idée ou d'une
// suggestion dans la grille d'une collection partagée. Même gabarit que la
// carte d'un objet possédé, mais contour pointillé et contenu estompé : on
// lit tout de suite que l'objet n'est pas (encore) là.
//
// Le contenu est partagé par les variantes lien / sans lien : styled-jsx ne
// scope pas le JSX rangé dans une variable, d'où les sélecteurs :global()
// sous .card.
import { linkHost, type Wish } from '../../lib/suggestions'
import AuthorAvatar from './AuthorAvatar'

function price(amount: number | null, currency: string): string | null {
  if (amount === null) return null
  try {
    return amount.toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0 })
  } catch {
    return `${amount} ${currency}`
  }
}

export default function WishCard({ wish }: { wish: Wish }) {
  const host = linkHost(wish.url)
  const amount = price(wish.price, wish.currency)
  const pending = wish.status === 'suggested'

  const body = (
    <>
      <div className="cover">
        <span className="cover-icon" aria-hidden>{pending ? '🎁' : '💡'}</span>
        <span className={`kind ${pending ? 'kind-pending' : 'kind-idea'}`}>
          {pending ? 'Suggestion' : 'Idée'}
        </span>
      </div>
      <div className="body">
        <h2 className="title">{wish.title}</h2>
        {(amount || host) && (
          <p className="meta">
            {amount && <span className="price">{amount}</span>}
            {amount && host && <span className="sep">·</span>}
            {host && <span className="host">{host}</span>}
          </p>
        )}
        {pending && wish.author && (
          <p className="author">
            <AuthorAvatar author={wish.author} size={22} />
            <span>Suggéré par <strong>{wish.author.firstName}</strong></span>
          </p>
        )}
      </div>
    </>
  )

  return (
    <>
      {wish.url ? (
        <a className={`card ${pending ? 'pending' : 'idea'}`} href={wish.url} target="_blank" rel="noopener noreferrer nofollow">
          {body}
        </a>
      ) : (
        <div className={`card ${pending ? 'pending' : 'idea'}`}>{body}</div>
      )}
      <style jsx>{`
        .card {
          display: block; text-decoration: none; color: inherit;
          background: rgba(255,255,255,0.55);
          border-radius: 16px;
          border: 1.5px dashed #CFC6BA;
          overflow: hidden;
          transition: box-shadow 0.15s, transform 0.15s, opacity 0.15s;
        }
        a.card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); transform: translateY(-2px); }
        .card.pending { border-color: #F2A766; }
        .card :global(.cover) {
          aspect-ratio: 1; position: relative;
          display: grid; place-items: center;
          background: repeating-linear-gradient(135deg, var(--beige-2) 0 10px, var(--border-light) 10px 20px);
        }
        .card :global(.cover-icon) { font-size: 44px; opacity: 0.55; }
        .card :global(.kind) {
          position: absolute; top: 8px; left: 8px;
          padding: 2px 8px; border-radius: 999px;
          font-size: 11px; font-weight: 700; line-height: 1.6;
        }
        .card :global(.kind-idea) { background: #EDE7DF; color: var(--muted); }
        .card :global(.kind-pending) { background: #FDE7D3; color: #B04E00; }
        .card :global(.body) { padding: 16px; display: flex; flex-direction: column; gap: 6px; opacity: 0.8; }
        .card :global(.title) { font-size: 15px; font-weight: 600; color: var(--ink); line-height: 1.3; margin: 0; }
        .card :global(.meta) { font-size: 12px; color: var(--muted); display: flex; gap: 6px; flex-wrap: wrap; margin: 0; }
        .card :global(.price) { font-weight: 700; color: #F26900; }
        .card :global(.sep) { color: var(--text-tertiary); }
        .card :global(.author) { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); margin: 2px 0 0; }
      `}</style>
    </>
  )
}
