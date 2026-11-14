// pages/essai/sauvegarde — où l'on revient après avoir créé son compte (ou
// s'être connecté) depuis l'essai sans compte : l'objet d'essai est rattaché
// au compte, sans rien ressaisir, puis la question du profil est posée —
// une question, un tap (components/account/ProfileTypeChoice.tsx).
//
// L'essai est retrouvé par le cookie de ce navigateur, sinon par le code
// rangé dans les métadonnées à l'inscription (e-mail confirmé sur un autre
// appareil). Le rattachement est rejouable : recharger la page ne crée
// jamais un second objet.
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProfileTypeChoice from '../../components/account/ProfileTypeChoice'
import { asLocale, localePrefix } from '../../lib/localeRouting'
import { adminSupabase, serverSupabase } from '../../lib/supabase'
import { SAVE_PATH } from '../../lib/trial'
import { claimTrial, clearTrialCookie, trialFromClaimCode, trialFromCookie } from '../../lib/trialServer'
import { useCopy } from '../../locales'

type Props =
  | { state: 'saved'; userId: string; objectId: string }
  | { state: 'quota' | 'failed' }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  ctx.res.setHeader('Cache-Control', 'no-store')
  const prefix = localePrefix(asLocale(ctx.locale))
  const to = (destination: string) => ({ redirect: { destination: `${prefix}${destination}`, permanent: false as const } })

  // getUser() et non getSession() : le jeton est vérifié auprès de Supabase.
  const { data: { user } } = await serverSupabase(ctx).auth.getUser()
  if (!user) return to(`/inscription?next=${encodeURIComponent(SAVE_PATH)}`)

  const admin = adminSupabase()
  const metaCode = user.user_metadata?.trial
  /** Le code des métadonnées a servi (ou ne mène plus à rien) : on l'efface. */
  const forgetCode = async () => {
    if (metaCode == null) return
    const { error } = await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, trial: null } })
    if (error) console.error('essai/sauvegarde métadonnées', error.message)
  }

  const row = (await trialFromCookie(admin, ctx.req)) ?? (await trialFromClaimCode(admin, metaCode))
  if (!row) {
    await forgetCode()
    // essai=0 : l'accueil ne renvoie pas ici une seconde fois.
    return to('/accueil?essai=0')
  }

  const result = await claimTrial(admin, user.id, row)
  if (result.ok) {
    clearTrialCookie(ctx.req, ctx.res)
    await forgetCode()
    const { data: profile } = await admin.from('profiles').select('user_profile').eq('id', user.id).maybeSingle()
    // Profil déjà choisi (compte existant) : droit à la fiche.
    if (profile?.user_profile) return to(`/mes-collections/objets/${result.objectId}`)
    return { props: { state: 'saved', userId: user.id, objectId: result.objectId } satisfies Props }
  }
  if (result.reason === 'NOT_ESTIMATED') return to('/essai')
  if (result.reason === 'CLAIMED_BY_OTHER') {
    clearTrialCookie(ctx.req, ctx.res)
    await forgetCode()
    return to('/accueil?essai=0')
  }
  return { props: { state: result.reason === 'OBJECT_QUOTA_EXCEEDED' ? 'quota' : 'failed' } satisfies Props }
}

export default function EssaiSauvegarde(props: Props) {
  const router = useRouter()
  const { t: { trial: { saved: t }, inventory: { profileType: tp } }, locale } = useCopy()
  const prefix = localePrefix(locale)
  const objectHref = props.state === 'saved' ? `/mes-collections/objets/${props.objectId}` : '/accueil'

  return (
    <>
      <Head>
        <title>{t.metaTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="root">
        <div className="card">
          <div className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/app-icon.png" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
            <strong>Tiroir</strong>
          </div>

          {props.state === 'saved' && (
            <>
              <p className="done"><span aria-hidden="true">✓ </span>{t.title} {t.text}</p>
              <h1>{tp.title}</h1>
              <p className="text">{tp.subtitle}</p>
              <ProfileTypeChoice userId={props.userId} onSaved={() => router.push(objectHref)} />
              <a className="skip" href={prefix + objectHref}>{tp.skip}</a>
            </>
          )}
          {props.state === 'quota' && (
            <>
              <h1>{t.quotaTitle}</h1>
              <p className="text">{t.quotaText}</p>
              <a className="primary" href={`${prefix}/pricing`}>{t.seePricing}</a>
            </>
          )}
          {props.state === 'failed' && (
            <>
              <h1>{t.failedTitle}</h1>
              <p className="text">{t.failedText}</p>
              <a className="primary" href={prefix + SAVE_PATH}>{t.retry}</a>
            </>
          )}
        </div>
      </main>
      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--beige); padding: 24px 16px; font-family: var(--font-body); color: var(--ink); }
        .card { width: 100%; max-width: 460px; background: var(--white); border-radius: 20px; padding: 32px 24px; box-shadow: 0 6px 24px rgba(0,0,0,0.08); }
        .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-size: 20px; }
        .done { margin: 0 0 20px; padding: 10px 14px; border-radius: 10px; background: var(--beige); font-size: 14px; line-height: 1.45; font-weight: 600; color: var(--success); }
        h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.3px; line-height: 1.2; margin: 0 0 8px; }
        .text { font-size: 15px; line-height: 1.5; color: var(--muted); margin: 0 0 20px; }
        .primary { display: flex; align-items: center; justify-content: center; min-height: 50px; border-radius: 12px; background: var(--orange); color: var(--white); font-size: 15px; font-weight: 700; text-decoration: none; }
        .skip { display: block; margin-top: 14px; padding: 10px; text-align: center; font-size: 14px; font-weight: 600; color: var(--muted); text-decoration: none; }
        a:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
      `}</style>
    </>
  )
}
