import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { adminSupabase } from '../lib/supabase'
import { localePrefix } from '../lib/localeRouting'
import { useCopy } from '../locales'

/**
 * Page de désinscription.
 *
 * Deux principes, tous deux imposés par la façon dont les clients mail
 * traitent réellement ce lien :
 *
 * 1. **La désinscription est faite au chargement**, pas derrière un
 *    bouton de confirmation. Gmail et Yahoo exigent depuis 2024 une
 *    désinscription en un clic pour tout expéditeur de volume ; une page
 *    qui redemande « confirmez-vous ? » ne satisfait pas cette règle, et
 *    surtout elle pousse le lecteur pressé vers le bouton « spam », qui
 *    coûte infiniment plus cher.
 *
 * 2. **Aucune authentification.** Personne ne se connecte pour se
 *    désabonner. Le jeton est un UUID aléatoire propre au compte : il
 *    autorise cette seule action, ne révèle pas l'identifiant du compte
 *    et ne donne accès à rien d'autre.
 *
 * Un jeton inconnu affiche le même message rassurant qu'un succès. Il
 * n'y a rien à protéger ici, et laisser entendre « ce lien n'existe
 * pas » à quelqu'un qui veut partir ne fait que le renvoyer vers le
 * bouton « spam ».
 */
type Props = { statut: 'ok' | 'inconnu' }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const jeton = typeof ctx.query.t === 'string' ? ctx.query.t : ''
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (!uuid.test(jeton)) return { props: { statut: 'inconnu' } }

  const { data, error } = await adminSupabase().rpc('unsubscribe_by_token', { p_token: jeton })
  return { props: { statut: !error && data === true ? 'ok' : 'inconnu' } }
}

export default function Desinscription({ statut }: Props) {
  const { t: { account: { unsubscribe: t } }, locale } = useCopy()
  return (
    <>
      <Head>
        <title>{t.metaTitle}</title>
        {/* Une page de désinscription n'a aucune raison d'être indexée. */}
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--beige-2)', padding: 24,
        fontFamily: 'var(--font-body)',
      }}>
        <div style={{
          maxWidth: 460, width: '100%', backgroundColor: 'var(--white)',
          border: '1px solid var(--border)', borderRadius: 16, padding: 40, textAlign: 'center',
        }}>
          <img
            src="/icons/app-icon.png" alt="Tiroir" width={44} height={44}
            style={{ borderRadius: 11, display: 'block', margin: '0 auto 24px' }}
          />

          {statut === 'ok' ? (
            <>
              <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.4px' }}>
                {t.okTitle}
              </h1>
              <p style={{ margin: '0 0 8px', fontSize: 16, lineHeight: '26px', color: 'var(--muted)' }}>
                {t.okText}
              </p>
              <p style={{ margin: 0, fontSize: 15, lineHeight: '24px', color: 'var(--text-tertiary)' }}>
                {t.okDetail}
              </p>
            </>
          ) : (
            <>
              <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.4px' }}>
                {t.unknownTitle}
              </h1>
              <p style={{ margin: '0 0 8px', fontSize: 16, lineHeight: '26px', color: 'var(--muted)' }}>
                {t.unknownText}
              </p>
              <p style={{ margin: 0, fontSize: 15, lineHeight: '24px', color: 'var(--text-tertiary)' }}>
                {t.unknownDetail}
              </p>
            </>
          )}

          <a href={`https://www.tiroir.app${localePrefix(locale)}`} style={{
            display: 'inline-block', marginTop: 28, fontSize: 15, fontWeight: 600,
            color: 'var(--orange)', textDecoration: 'none',
          }}>
            {t.back}
          </a>
        </div>
      </main>
    </>
  )
}
