import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'
import { supabase, serverSupabase, signOutEverywhere } from '../lib/supabase'
import { uploadAvatar, removeAvatar } from '../lib/avatar'
import HeaderApp from '../components/layout/HeaderApp'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import { asLocale, localePrefix } from '../lib/localeRouting'
import { intlLocale, useCopy } from '../locales'

type ProfileError = 'saveError' | 'photoUnsupported' | 'photoSaveError' | 'photoRemoveError'

interface Props {
  userId: string
  email: string
  displayName: string
  avatarUrl: string | null
  /** Photo choisie par l'utilisateur, chemin dans object-images. */
  avatarPath: string | null
  memberSince: string | null
}

export default function Profil({ userId, email, displayName, avatarUrl, avatarPath, memberSince }: Props) {
  const { t: { account: { profile: t } }, locale } = useCopy()
  const [name, setName] = useState(displayName)
  const [savedName, setSavedName] = useState(displayName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<ProfileError | null>(null)
  const [photoUrl, setPhotoUrl] = useState(avatarUrl)
  const [photoPath, setPhotoPath] = useState(avatarPath)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<ProfileError | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  function pickPhoto() {
    setViewerOpen(false)
    fileInput.current?.click()
  }

  // Visionneuse : Échap la ferme, et la page ne défile pas derrière.
  useEffect(() => {
    if (!viewerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setViewerOpen(false) }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [viewerOpen])

  const initial = (savedName || email).charAt(0).toUpperCase()
  const dirty = name.trim() !== savedName

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: trimmed || null })
      .eq('id', userId)

    setSaving(false)
    if (updateError) {
      setError('saveError')
      return
    }
    setSavedName(trimmed)
    setSaved(true)
    window.dispatchEvent(
      new CustomEvent('tiroir:profile-updated', { detail: { displayName: trimmed || email.split('@')[0] } })
    )
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const path = await uploadAvatar(userId, file, photoPath)
      setPhotoPath(path)
      setPhotoUrl(URL.createObjectURL(file))
    } catch (err) {
      const unreadable = err instanceof DOMException || (err instanceof Error && err.message === 'ENCODE')
      setPhotoError(unreadable ? 'photoUnsupported' : 'photoSaveError')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handleRemovePhoto() {
    if (!photoPath) return
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      await removeAvatar(userId, photoPath)
      setPhotoPath(null)
      setPhotoUrl(null)
    } catch {
      setPhotoError('photoRemoveError')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handleSignOut() {
    await signOutEverywhere()
    window.location.assign(localePrefix(locale) || '/')
  }

  return (
    <>
      <Head>
        <title>{t.metaTitle}</title>
        <meta name="robots" content="noindex" />
      </Head>

      <HeaderApp />

      <main className="main">
        <div className="page-hero">
          <h1 className="page-title">{t.title}</h1>
          <p className="page-sub">{t.subtitle}</p>
        </div>

        <section className="card">
          <div className="identity">
            <div className="avatar-wrap">
              {/* Avec une photo, un clic l'agrandit ; sans photo, il en propose une. */}
              <button
                type="button"
                className="avatar-btn"
                onClick={() => (photoUrl ? setViewerOpen(true) : pickPhoto())}
                disabled={photoBusy}
                aria-label={photoUrl ? t.viewPhoto : t.addPhotoAria}
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="avatar" src={photoUrl} alt="" />
                ) : (
                  <div className="avatar avatar--initial">{initial}</div>
                )}
              </button>
              <button
                type="button"
                className="avatar-badge"
                onClick={pickPhoto}
                disabled={photoBusy}
                aria-label={t.changePhotoAria}
              >
                {photoBusy ? '…' : '✎'}
              </button>
            </div>
            {/* Masqué aussi par style : l'attribut hidden seul n'a pas suffi en
                prod (vu sur iPhone), le bouton natif « Choisir le fichier »
                s'affichait et poussait le nom hors de la carte. */}
            <input
              ref={fileInput}
              className="file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              hidden
              style={{ display: 'none' }}
              tabIndex={-1}
              aria-hidden="true"
              onChange={handlePhoto}
            />
            <div className="identity-text">
              <p className="identity-name">{savedName || email.split('@')[0]}</p>
              <p className="identity-email">{email}</p>
              <div className="photo-actions">
                <button type="button" className="link-btn" onClick={pickPhoto} disabled={photoBusy}>
                  {photoBusy ? t.uploading : photoPath ? t.changePhoto : t.addPhoto}
                </button>
                {photoPath && (
                  <button type="button" className="link-btn link-btn--muted" onClick={handleRemovePhoto} disabled={photoBusy}>
                    {t.removePhoto}
                  </button>
                )}
              </div>
              {photoError && <p className="feedback feedback--error">{t[photoError]}</p>}
            </div>
          </div>

          <form onSubmit={handleSave} className="form">
            <label className="label" htmlFor="display-name">{t.nameLabel}</label>
            <div className="row">
              <input
                id="display-name"
                className="input"
                type="text"
                value={name}
                maxLength={60}
                placeholder={t.namePlaceholder}
                onChange={e => { setName(e.target.value); setSaved(false) }}
              />
              <button className="save-btn" type="submit" disabled={saving || !dirty}>
                {saving ? t.saving : t.save}
              </button>
            </div>
            {error && <p className="feedback feedback--error">{t[error]}</p>}
            {saved && !dirty && <p className="feedback feedback--ok">{t.nameSaved}</p>}
          </form>

          <dl className="meta">
            <div className="meta-row">
              <dt>{t.email}</dt>
              <dd>{email}</dd>
            </div>
            {memberSince && (
              <div className="meta-row">
                <dt>{t.memberSince}</dt>
                <dd>
                  {new Date(memberSince).toLocaleDateString(intlLocale(locale), {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="card card--danger">
          <div>
            <p className="danger-title">{t.signOutTitle}</p>
            <p className="danger-sub">{t.signOutText}</p>
          </div>
          <button className="signout-btn" type="button" onClick={handleSignOut}>
            {t.signOut}
          </button>
        </section>
      </main>
      <FooterTiroirWeb />

      {viewerOpen && photoUrl && (
        <div
          className="viewer"
          role="dialog"
          aria-modal="true"
          aria-label={t.photo}
          onClick={() => setViewerOpen(false)}
        >
          <button type="button" className="viewer-close" aria-label={t.close} onClick={() => setViewerOpen(false)}>✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="viewer-img" src={photoUrl} alt={t.photo} onClick={e => e.stopPropagation()} />
          <div className="viewer-actions" onClick={e => e.stopPropagation()}>
            <button type="button" className="viewer-btn" onClick={pickPhoto}>{t.changePhoto}</button>
            <button type="button" className="viewer-btn viewer-btn--ghost" onClick={() => setViewerOpen(false)}>{t.close}</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .main {
          max-width: 640px;
          width: 100%;
          margin: 0 auto;
          padding: 32px 24px 56px;
          box-sizing: border-box;
        }

        .page-hero { margin-bottom: 28px; }
        .page-title { font-size: 28px; font-weight: 800; color: var(--ink); line-height: 1.2; }
        .page-sub { font-size: 14px; color: var(--text-tertiary); margin-top: 6px; }

        .card {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 16px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.06);
          padding: 24px;
        }

        .identity {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .avatar-wrap { position: relative; flex-shrink: 0; }
        .file-input { display: none !important; }
        .identity-text { min-width: 0; flex: 1; }
        .identity-text .identity-email { overflow-wrap: anywhere; }
        .avatar-btn {
          display: block;
          padding: 0;
          border: 0;
          background: none;
          cursor: pointer;
          flex-shrink: 0;
          border-radius: 50%;
        }
        .avatar-btn:disabled { cursor: default; opacity: 0.7; }
        .avatar-badge {
          padding: 0;
          cursor: pointer;
          position: absolute;
          right: -2px;
          bottom: -2px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #F26900;
          color: #fff;
          border: 2px solid #fff;
          display: grid;
          place-items: center;
          font-size: 11px;
          line-height: 1;
        }
        .avatar-badge:disabled { cursor: default; }
        .viewer {
          position: fixed;
          inset: 0;
          z-index: 10000;
          background: rgba(26, 22, 18, 0.96);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 24px;
          box-sizing: border-box;
        }
        .viewer-img {
          width: min(88vw, 70vh, 640px);
          height: min(88vw, 70vh, 640px);
          object-fit: cover;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          background: #2A241F;
        }
        .viewer-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 0;
          background: rgba(255,255,255,0.14);
          color: #fff;
          font-size: 18px;
          cursor: pointer;
        }
        .viewer-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .viewer-btn {
          padding: 10px 18px;
          border-radius: 10px;
          border: 0;
          background: #F26900;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .viewer-btn--ghost { background: rgba(255,255,255,0.14); }
        .photo-actions { display: flex; gap: 14px; margin-top: 6px; }
        .link-btn {
          padding: 0;
          border: 0;
          background: none;
          color: #F26900;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .link-btn:disabled { opacity: 0.5; cursor: default; }
        .link-btn--muted { color: var(--muted); }
        .avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          background: #FFF4E6;
        }
        .avatar--initial {
          background: #FFF4E6;
          color: #F26900;
          display: grid;
          place-items: center;
          font-size: 24px;
          font-weight: 800;
        }
        .identity-name { font-size: 17px; font-weight: 800; color: var(--ink); margin: 0; }
        .identity-email { font-size: 13px; color: var(--muted); margin: 4px 0 0; }

        .form { padding: 20px 0; border-bottom: 1px solid rgba(0,0,0,0.06); }
        .label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #555;
          margin-bottom: 8px;
        }
        .row { display: flex; gap: 10px; flex-wrap: wrap; }
        .input {
          flex: 1;
          min-width: 200px;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid #e0e0e0;
          font-size: 15px;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: #F26900; }
        .save-btn {
          padding: 10px 18px;
          border-radius: 10px;
          border: 0;
          background: #F26900;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }
        .save-btn:hover:not(:disabled) { background: #D85E00; }
        .save-btn:disabled { opacity: 0.5; cursor: default; }
        .feedback { font-size: 13px; margin: 10px 0 0; }
        .feedback--error { color: #C0392B; }
        .feedback--ok { color: #1E8E3E; }

        .meta { margin: 0; padding-top: 20px; }
        .meta-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 6px 0;
        }
        .meta-row dt { font-size: 14px; color: var(--muted); }
        .meta-row dd { font-size: 14px; font-weight: 600; color: var(--ink); margin: 0; text-align: right; }

        .card--danger {
          margin-top: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .danger-title { font-size: 15px; font-weight: 700; color: var(--ink); margin: 0; }
        .danger-sub { font-size: 13px; color: var(--muted); margin: 4px 0 0; }
        .signout-btn {
          padding: 10px 18px;
          border-radius: 10px;
          border: 1px solid rgba(192,57,43,0.3);
          background: transparent;
          color: #C0392B;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }
        .signout-btn:hover { background: #FDECEA; }
      `}</style>

      <style jsx global>{`
        body { background: #FDFAF6; }
      `}</style>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const sb = serverSupabase(ctx)
  // getUser() et non getSession() : getSession() lit le cookie sans vérifier
  // sa signature ; un cookie fabriqué passerait. getUser() fait valider le
  // jeton par Supabase avant toute lecture avec la clé service.
  const { data: { user: verifiedUser } } = await sb.auth.getUser()
  const session = verifiedUser ? { user: verifiedUser } : null

  if (!session) {
    // Destination absolue : Next n'y ajoute pas la langue, on la garde.
    return { redirect: { destination: `${localePrefix(asLocale(ctx.locale))}/login`, permanent: false } }
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('display_name, avatar_url, avatar_path, created_at')
    .eq('id', session.user.id)
    .single()

  // Bucket privé : la photo choisie s'affiche par URL signée, valable le
  // temps d'une visite de la page.
  let avatarUrl: string | null = profile?.avatar_url ?? null
  if (profile?.avatar_path) {
    const { data: signed } = await sb.storage
      .from('object-images')
      .createSignedUrl(profile.avatar_path, 3600)
    avatarUrl = signed?.signedUrl ?? avatarUrl
  }

  return {
    props: {
      userId: session.user.id,
      email: session.user.email ?? '',
      displayName: profile?.display_name ?? '',
      avatarUrl,
      avatarPath: profile?.avatar_path ?? null,
      memberSince: profile?.created_at ?? null,
    },
  }
}
