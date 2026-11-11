// Lien perso d'un ambassadeur : enregistre le clic, puis emmène sur la page
// Ulule avec ses paramètres de suivi. Avant le lancement, la page Ulule
// n'est pas publique : on affiche un rendez-vous à la place.
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { adminSupabase } from '../../lib/supabase'
import { campaignUrl, formatLaunchDate, referrerOrigin, SLUG_FORMAT } from '../../lib/ulule'
import { fallbackPageUrl } from '../../lib/ululeProgress'
import { useCopy } from '../../locales'

type Props = { date: string }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'private, no-store')
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')

  const slug = String(ctx.params?.slug ?? '').toLowerCase()
  const db = adminSupabase()
  const { data: campaign } = await db.from('ulule_campaign').select('*').eq('id', 1).single()
  if (!campaign) return { redirect: { destination: fallbackPageUrl(), permanent: false } }

  const { data: ambassador } = SLUG_FORMAT.test(slug)
    ? await db.from('ambassadors').select('slug').eq('slug', slug).maybeSingle()
    : { data: null }

  // Une erreur d'écriture ne doit jamais empêcher d'arriver à destination.
  if (ambassador && ctx.req.method === 'GET') {
    const { error } = await db.from('link_clicks').insert({
      slug,
      user_agent: (ctx.req.headers['user-agent'] ?? '').slice(0, 300) || null,
      referrer: referrerOrigin(ctx.req.headers.referer),
    })
    if (error) console.error('link_clicks', error.message)
  }

  if (Date.now() >= new Date(campaign.launch_at).getTime()) {
    const destination = ambassador
      ? campaignUrl(campaign.page_url, campaign.presale_number, slug)
      : campaign.page_url
    return { redirect: { destination, permanent: false } }
  }

  return { props: { date: formatLaunchDate(campaign.launch_at, ctx.locale ?? 'fr') } }
}

export default function LienAmbassadeur({ date }: Props) {
  const { t: { account: { campaign: t } }, locale } = useCopy()
  return (
    <>
      <Head>
        <title>{t.metaTitle}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="page">
        <div className="card">
          <h1>{t.title.replace('{date}', date)}</h1>
          <p>{t.text}</p>
          <Link href="/" locale={locale}>{t.home}</Link>
        </div>
        <style jsx>{`
          .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); }
          .card { max-width: 460px; width: 100%; background: var(--white); border: 1px solid var(--border); border-radius: 16px; padding: 40px 24px; text-align: center; }
          h1 { margin: 0 0 12px; font-size: 26px; }
          p { margin: 0 0 24px; color: var(--muted); line-height: 1.5; }
        `}</style>
      </main>
    </>
  )
}
