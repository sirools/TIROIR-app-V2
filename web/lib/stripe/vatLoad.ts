// Factures Stripe payées, lues page par page (serveur seulement). Partagé
// par l'export CSV (/api/admin/vat-export) et le tableau « TVA collectée »
// de la page Facturation.
//
// Une facture payée dans un mois a pu être émise avant (échéance, relance) :
// on lit les factures créées jusqu'à 62 jours plus tôt ; le tri par date de
// paiement se fait ensuite (vatRows).
import type { StripeCall } from './api'

export async function fetchPaidInvoices(stripe: StripeCall, from: number, to: number, maxPages = 50): Promise<unknown[]> {
  const invoices: { id: string }[] = []
  let startingAfter: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const list = await stripe<{ data: { id: string }[]; has_more: boolean }>('GET', '/v1/invoices', {
      status: 'paid', limit: 100,
      created: { gte: from - 62 * 86400, lt: to },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    invoices.push(...list.data)
    if (!list.has_more || !list.data.length) break
    startingAfter = list.data[list.data.length - 1].id
  }
  return invoices
}
