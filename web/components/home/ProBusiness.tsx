import Link from 'next/link'
import { Building2, Calculator, FileCheck2, Layers, ListChecks } from 'lucide-react'
import { formatEur, useCopy } from '../../locales'
import s from './home.module.css'

const ICONS = [Calculator, Layers, ListChecks, FileCheck2]

/** Contact Business : la même adresse que la page Tarifs (à valider). */
export const BUSINESS_CONTACT = 'mailto:hello@tiroir.app?subject=Tiroir%20Business'

/** Lignes fictives de l'aperçu d'export (valeurs en euros). */
const ROWS = [4200, 1150, 680, 890]

/**
 * Section Pro et Business (#pro), vouvoiement sans exception, registre
 * sobre. Les deux offres sont à venir (page Tarifs : « Bientôt
 * disponible ») : badge en tête, verbes au futur, aucun prix ici.
 * Rien d'autre que ce que la page Tarifs annonce : pas de rôles, de
 * multi-comptes, de SLA ni d'API.
 */
export default function ProBusiness() {
  const { t: { home: { pro: t } }, locale } = useCopy()
  const eur = (n: number) => formatEur(n, locale)
  const total = ROWS.reduce((a, b) => a + b, 0)

  return (
    <section id="pro" className={`${s.section} ${s.proSec}`} aria-labelledby="pro-title">
      <div className={s.wrap}>
        <div className={s.head}>
          <p className={s.eyebrow}>
            {t.eyebrow}
            <span className={s.proBadge}>{t.badge}</span>
          </p>
          <h2 id="pro-title" className={s.h2}>{t.title}</h2>
          <p className={s.lead}>{t.sub}</p>
        </div>

        <div className={s.proGrid}>
          <div>
            <h3 className={s.proBlockTitle}>Pro</h3>
            <ul className={s.proPoints}>
              {t.points.map((p, i) => {
                const Icon = ICONS[i]
                return (
                  <li key={p.title} className={s.proPoint} data-rv="">
                    <Icon size={20} aria-hidden="true" />
                    <div>
                      <h4 className={s.proPointTitle}>{p.title}</h4>
                      <p className={s.proText}>{p.text}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            <Link href="/pricing" className={s.proCta}>{t.ctaPro}</Link>
            <p className={s.proNote}>{t.ctaNote}</p>
          </div>

          <figure className={s.proExport} role="img" aria-label={t.preview.label} data-rv="">
            <div className={s.proExportHead} aria-hidden="true">
              <strong>{t.preview.title}</strong>
              <span>{t.preview.tag}</span>
            </div>
            <p className={s.proExportSub} aria-hidden="true">{t.preview.subtitle}</p>
            <table className={s.proTable} aria-hidden="true">
              <thead>
                <tr>{t.preview.cols.map(c => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {t.preview.rows.map(([name, cat], i) => (
                  <tr key={name}><td>{name}</td><td>{cat}</td><td>{eur(ROWS[i])}</td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={2}>{t.preview.total}</td><td>{eur(total)}</td></tr>
              </tfoot>
            </table>
          </figure>
        </div>

        <div className={s.bizBlock} data-rv="">
          <Building2 size={24} aria-hidden="true" />
          <div>
            <h3 className={s.proBlockTitle}>{t.business.title}</h3>
            <p className={s.proText}>{t.business.text}</p>
          </div>
          <a href={BUSINESS_CONTACT} className={s.bizCta}>{t.business.cta}</a>
        </div>
      </div>
    </section>
  )
}
