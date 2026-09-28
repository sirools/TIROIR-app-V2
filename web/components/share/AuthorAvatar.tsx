// components/share/AuthorAvatar.tsx — photo de profil de l'auteur d'une
// suggestion, ou son initiale à défaut.
import type { WishAuthor } from '../../lib/suggestions'

export default function AuthorAvatar({ author, size = 24 }: { author: WishAuthor; size?: number }) {
  return (
    <>
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="avatar" src={author.avatarUrl} alt="" width={size} height={size} />
      ) : (
        <span className="avatar initial" aria-hidden>{author.firstName.charAt(0).toUpperCase()}</span>
      )}
      <style jsx>{`
        .avatar {
          width: ${size}px; height: ${size}px; border-radius: 50%;
          object-fit: cover; flex-shrink: 0; display: inline-block;
        }
        .initial {
          display: inline-grid; place-items: center;
          background: #F26900; color: #fff;
          font-size: ${Math.round(size * 0.45)}px; font-weight: 700;
        }
      `}</style>
    </>
  )
}
