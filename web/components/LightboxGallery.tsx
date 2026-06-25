// apps/next/components/LightboxGallery.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import ReactDOM from 'react-dom'

type Img = { src: string; alt?: string }

type Props = {
  images: Img[]
  initialIndex?: number
  thumbnailSize?: number // px
  className?: string
}

export default function LightboxGallery({
  images,
  initialIndex = 0,
  thumbnailSize = 72,
  className,
}: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [open, setOpen] = useState(false)

  const hasImages = images && images.length > 0
  const safeIndex = useMemo(
    () => (hasImages ? Math.min(Math.max(index, 0), images.length - 1) : 0),
    [index, images, hasImages]
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length)
      if (e.key === 'ArrowLeft')
        setIndex((i) => (i - 1 + images.length) % images.length)
    }
    document.addEventListener('keydown', onKey)
    // lock scroll
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, images?.length])

  if (!hasImages) return null

  const main = images[safeIndex]

  return (
    <div className={className}>
      {/* Zone principale */}
      <div className="main" onClick={() => setOpen(true)} role="button" aria-label="Agrandir l'image">
        <Image
          src={main.src}
          alt={main.alt ?? `Image ${safeIndex + 1}`}
          fill
          sizes="(max-width: 768px) 100vw, 800px"
          priority
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* Thumbnails */}
      <div className="thumbs" role="listbox" aria-label="Miniatures">
        {images.map((img, i) => (
          <button
            key={img.src + i}
            className={`thumb ${i === safeIndex ? 'active' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`Voir image ${i + 1}`}
          >
            {/* on passe par <img> pour éviter d'avoir besoin des dimensions */}
            <img src={img.src} alt={img.alt ?? `Miniature ${i + 1}`} />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {open &&
        ReactDOM.createPortal(
          <LightboxOverlay
            images={images}
            index={safeIndex}
            onClose={() => setOpen(false)}
            onPrev={() => setIndex((i) => (i - 1 + images.length) % images.length)}
            onNext={() => setIndex((i) => (i + 1) % images.length)}
          />,
          document.body
        )}

      <style jsx>{`
        .main {
          position: relative;
          width: 100%;
          padding-top: 66.66%; /* ratio 3/2, s'adapte au container */
          background: #f3f3f3;
          border-radius: 12px;
          overflow: hidden;
          cursor: zoom-in;
        }
        .thumbs {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .thumb {
          flex: 0 0 auto;
          width: ${thumbnailSize}px;
          height: ${thumbnailSize}px;
          border-radius: 8px;
          border: 2px solid transparent;
          overflow: hidden;
          padding: 0;
          background: transparent;
          cursor: pointer;
        }
        .thumb.active {
          border-color: #111;
        }
        .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      `}</style>
    </div>
  )
}

function LightboxOverlay({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: Img[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse d'images"
      ref={containerRef}
      tabIndex={-1}
      onClick={(e) => {
        // clic sur l'arrière-plan ferme
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <button className="close" aria-label="Fermer" onClick={onClose}>
        ×
      </button>

      <button className="nav prev" aria-label="Précédent" onClick={onPrev}>
        ‹
      </button>

      <div className="stage" onClick={onNext} aria-label="Suivant (clic)">
        <img
          src={images[index].src}
          alt={images[index].alt ?? `Image ${index + 1}`}
          draggable={false}
        />
      </div>

      <button className="nav next" aria-label="Suivant" onClick={onNext}>
        ›
      </button>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.92);
          display: grid;
          grid-template-columns: 80px 1fr 80px;
          grid-template-rows: 64px 1fr 64px;
          color: #fff;
          z-index: 9999;
          cursor: default;
        }
        .close {
          position: absolute;
          top: 16px;
          right: 20px;
          font-size: 32px;
          line-height: 1;
          background: transparent;
          border: none;
          color: #fff;
          cursor: pointer;
        }
        .nav {
          background: transparent;
          border: none;
          color: #fff;
          font-size: 56px;
          cursor: pointer;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        .nav:hover {
          opacity: 1;
        }
        .prev {
          grid-column: 1;
          grid-row: 2;
          justify-self: center;
          align-self: center;
        }
        .next {
          grid-column: 3;
          grid-row: 2;
          justify-self: center;
          align-self: center;
        }
        .stage {
          grid-column: 2;
          grid-row: 2;
          align-self: stretch;
          justify-self: stretch;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer; /* clic = next */
          user-select: none;
        }
        .stage img {
          max-width: 90vw;
          max-height: 80vh;
          width: auto;
          height: auto;
          display: block;
          border-radius: 10px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }

        @media (max-width: 768px) {
          .overlay {
            grid-template-columns: 60px 1fr 60px;
            grid-template-rows: 56px 1fr 56px;
          }
          .nav {
            font-size: 44px;
          }
        }
      `}</style>
    </div>
  )
}