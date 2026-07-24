import { appStoreUrl, playStoreUrl } from '../lib/appLinks'

type Variant = 'dark' | 'onColor' | 'card' | 'cardPrimary'

function AppleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626-2.556-2.557 2.557-2.425zM5.864 2.658L16.802 8.99l-2.302 2.302-8.636-8.635z" />
    </svg>
  )
}

/**
 * Boutons de téléchargement App Store + Google Play, style harmonisé.
 * - variant : contexte visuel (fond sombre, sur couleur, carte…)
 * - full : les 2 boutons se partagent la largeur (utile dans les cartes)
 */
export default function StoreButtons({
  isEn = false,
  variant = 'dark',
  full = false,
}: {
  isEn?: boolean
  variant?: Variant
  full?: boolean
}) {
  return (
    <div className={`store-btns${full ? ' full' : ''}`}>
      <a
        className={`store-btn v-${variant}`}
        href={appStoreUrl(isEn)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <AppleIcon />
        <span>App Store</span>
      </a>
      <a
        className={`store-btn v-${variant}`}
        href={playStoreUrl(isEn)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <PlayIcon />
        <span>Google Play</span>
      </a>

      <style jsx>{`
        .store-btns {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }
        .store-btns.full {
          flex-wrap: nowrap;
        }
        .store-btns.full .store-btn {
          flex: 1 1 0;
          min-width: 0;
        }
        .store-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 13px 22px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.15s, background 0.15s;
        }
        .store-btn:hover {
          transform: translateY(-1px);
        }
        .v-dark {
          background: #fff;
          color: #1a1a1a;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        }
        .v-dark:hover {
          opacity: 0.9;
        }
        .v-onColor {
          background: #fff;
          color: #d85e00;
        }
        .v-onColor:hover {
          opacity: 0.92;
        }
        .v-card {
          background: #fff;
          color: #121212;
          border: 1.5px solid rgba(0, 0, 0, 0.12);
        }
        .v-card:hover {
          background: #faf7f3;
        }
        .v-cardPrimary {
          background: #f26900;
          color: #fff;
        }
        .v-cardPrimary:hover {
          background: #d85e00;
        }
        @media (max-width: 400px) {
          .store-btns.full {
            flex-direction: column;
          }
          .store-btns.full .store-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
