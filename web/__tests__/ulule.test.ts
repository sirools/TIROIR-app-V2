import { describe, expect, test } from 'vitest'
import {
  campaignUrl, firstNameOf, formatEuros, formatLaunchDate, parisInputToIso, parseAmbassadorLines, parseAmountCents,
  parseCsv, parseExport, parseMilestones, parseOrderDate, progressOf, referrerOrigin, toParisInput, uniqueSlug,
} from '../lib/ulule'
import { renderCampaign, renderPrelaunch, renderThanks } from '../lib/ululeEmails'
import { slugFromPageUrl } from '../lib/ululeProgress'

describe('ambassadeurs', () => {
  test('slug sans accent, puis suffixe en cas de doublon', () => {
    const taken = new Set<string>()
    expect(uniqueSlug('Éloïse', 'Le Gall', taken)).toBe('eloise-le-gall')
    expect(uniqueSlug('Eloise', 'le gall', taken)).toBe('eloise-le-gall-2')
  })

  test('une personne par ligne, les lignes illisibles sont rendues', () => {
    const { valid, invalid } = parseAmbassadorLines('Marie, Dupont, MARIE@Exemple.fr\nJean;jean@exemple.fr\nPaul, Dupont, paul@typo\nmauvaise@, Paul')
    expect(valid).toEqual([
      { firstName: 'Marie', lastName: 'Dupont', email: 'marie@exemple.fr' },
      { firstName: 'Jean', lastName: '', email: 'jean@exemple.fr' },
    ])
    expect(invalid).toEqual(['Paul, Dupont, paul@typo', 'mauvaise@, Paul'])
  })

  test('sans adresse : un lien seul, pour un proche prévenu par SMS', () => {
    expect(parseAmbassadorLines('Mamie, Ougier\nTonton').valid).toEqual([
      { firstName: 'Mamie', lastName: 'Ougier', email: null },
      { firstName: 'Tonton', lastName: '', email: null },
    ])
  })
})

describe('lien de campagne', () => {
  test('le slug est dans utm_source, seule colonne individuelle de l’export', () => {
    const url = new URL(campaignUrl('https://fr.ulule.com/tiroir-app/', '240562', 'marie-dupont'))
    expect(url.searchParams.get('utm_source')).toBe('marie-dupont')
    expect(url.searchParams.get('utm_medium')).toBe('ambassadeur')
    expect(url.searchParams.get('utm_campaign')).toBe('presale_240562')
  })

  test('du referrer, seule l’origine est gardée', () => {
    expect(referrerOrigin('https://mail.google.com/mail/u/0/#inbox/abc')).toBe('https://mail.google.com')
    expect(referrerOrigin('pas une adresse')).toBeNull()
    expect(referrerOrigin(undefined)).toBeNull()
  })
})

describe('dates, à l’heure de Paris', () => {
  test('hiver et été', () => {
    expect(parisInputToIso('2027-01-12T08:00')).toBe('2027-01-12T07:00:00.000Z')
    expect(parisInputToIso('2027-07-12T08:00')).toBe('2027-07-12T06:00:00.000Z')
    expect(toParisInput('2027-01-12T07:00:00.000Z')).toBe('2027-01-12T08:00')
  })

  test('la date de l’e-mail', () => {
    expect(formatLaunchDate('2027-01-12T07:00:00.000Z')).toBe('12 janvier')
  })

  test('export en format français ou ISO', () => {
    expect(parseOrderDate('12/01/2027 09:30')).toBe('2027-01-12T08:30:00.000Z')
    expect(parseOrderDate('2027-01-12T08:30:00Z')).toBe('2027-01-12T08:30:00.000Z')
    expect(parseOrderDate('n’importe quoi')).toBeNull()
  })
})

describe('lecture de l’export', () => {
  test('montants', () => {
    expect(parseAmountCents('25')).toBe(2500)
    expect(parseAmountCents('25,50 €')).toBe(2550)
    expect(parseAmountCents('1 200.00')).toBe(120000)
    expect(parseAmountCents('gratuit')).toBeNull()
  })

  test('séparateur, guillemets et marque BOM', () => {
    expect(parseCsv('﻿a;b\r\n"x;y";"il dit ""oui"""\r\n')).toEqual([['a', 'b'], ['x;y', 'il dit "oui"']])
  })

  const header = 'Order Id;User Email;User Full Name;Order Total;Order Status;Order Created At;UTM Source;UTM Medium'

  test('une commande complète', () => {
    const r = parseExport(`${header}\n42;Marie@Exemple.fr;Marie Dupont;25,00;payment-done;12/01/2027 09:30;Jean-Martin;ambassadeur\n`)
    expect(r.ok && r.orders[0]).toEqual({
      orderId: '42', email: 'marie@exemple.fr', name: 'Marie Dupont', amountCents: 2500,
      status: 'payment-done', contributedAt: '2027-01-12T08:30:00.000Z',
      utmSource: 'jean-martin', utmMedium: 'ambassadeur',
    })
  })

  test('un export de dons : intitulés « don » reconnus', () => {
    const r = parseExport('ID du don;Email;Nom complet;Montant du don;Statut;Date du don\n7;a@b.fr;Ana B;10;payment-done;24/11/2026 08:15\n')
    expect(r.ok && r.orders[0]).toMatchObject({ orderId: '7', amountCents: 1000, contributedAt: '2026-11-24T07:15:00.000Z' })
  })

  test('une colonne indispensable absente : refus, avec les colonnes trouvées', () => {
    const r = parseExport('Nom;Montant\nMarie;25\n')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('orderId')
    expect(!r.ok && r.columns).toEqual(['Nom', 'Montant'])
  })

  test('une ligne illisible est rejetée, pas devinée', () => {
    const r = parseExport(`${header}\n42;a@b.fr;A;gratuit;payment-done;;;\n`)
    expect(r.ok && r.orders).toEqual([])
    expect(r.ok && r.rejected[0].line).toBe(2)
  })

  test('prénom pour le merci', () => {
    expect(firstNameOf('  Marie Dupont ')).toBe('Marie')
    expect(firstNameOf('')).toBe('')
  })
})

describe('e-mails', () => {
  const values = {
    prenom: 'Marie <b>', date: '12 janvier', lien: 'https://tiroir.app/u/marie-dupont',
    desinscription: 'https://tiroir.app/desinscription?t=abc', adresse: '1 rue du Test',
  }

  test('pré-lancement : texte validé, lien perso, date, désinscription', () => {
    const m = renderPrelaunch(values)
    expect(m.subject).toBe('Tu fais partie des premiers, et j’ai besoin de toi')
    expect(m.text).toContain('Le 12 janvier, je lance une campagne Ulule')
    expect(m.text).toContain('partage ton lien perso : https://tiroir.app/u/marie-dupont')
    expect(m.html).toContain('href="https://tiroir.app/u/marie-dupont"')
    expect(m.html).toContain('href="https://tiroir.app/desinscription?t=abc"')
    expect(m.html).toContain('1 rue du Test')
    expect(m.html).not.toMatch(/\{\w+\}/)
  })

  test('un prénom ne peut pas injecter de HTML', () => {
    expect(renderPrelaunch(values).html).toContain('Marie &lt;b&gt;')
  })

  test('merci, avec ou sans prénom', () => {
    expect(renderThanks({ prenom: 'Marie' }).text).toMatch(/^Salut Marie,/)
    expect(renderThanks({ prenom: '' }).text).toMatch(/^Salut,/)
  })
})

describe('jauge et paliers', () => {
  const steps = [100_000, 200_000, 500_000]

  test('prochain palier, part remplie, paliers atteints', () => {
    expect(progressOf(0, steps)).toEqual({ amountCents: 0, nextCents: 100_000, ratio: 0, reached: 0 })
    expect(progressOf(150_000, steps)).toMatchObject({ nextCents: 200_000, ratio: 0.75, reached: 1 })
    expect(progressOf(200_000, steps)).toMatchObject({ nextCents: 500_000, reached: 2 })
    expect(progressOf(600_000, steps)).toMatchObject({ nextCents: null, ratio: 1, reached: 3 })
  })

  test('paliers saisis en euros dans l’admin', () => {
    expect(parseMilestones('5000, 1 000 ; 2000')).toEqual([100_000, 200_000, 500_000])
    expect(parseMilestones('1000, mille')).toBeNull()
    expect(parseMilestones('')).toBeNull()
  })

  test('montants sans centimes inutiles', () => {
    expect(formatEuros(100_000)).toBe('1\u00a0000\u00a0€')
    expect(formatEuros(2_550)).toBe('25,50\u00a0€')
  })

  test('slug de la page Ulule, pour l’API publique', () => {
    expect(slugFromPageUrl('https://fr.ulule.com/tiroir-app/')).toBe('tiroir-app')
    expect(slugFromPageUrl('pas une adresse')).toBeNull()
  })
})

describe('e-mails de la campagne', () => {
  const base = {
    prenom: 'Marie', lien: 'https://tiroir.app/u/marie-dupont',
    montant: '1\u00a0250\u00a0€', objectifAtteint: false,
    desinscription: 'https://tiroir.app/desinscription?t=abc', adresse: '',
  }

  test('lancement : Noël avant Noël, tout ou rien, objectif, date de fin, lien perso, désinscription', () => {
    const m = renderCampaign('launch', base)
    expect(m.subject).toContain('Noël avant Noël')
    expect(m.text).toContain('tout ou rien')
    expect(m.text).toContain('il faut réunir 4\u00a0000\u00a0€ avant le 21 décembre')
    expect(m.text).toContain('de 5\u00a0€ à 450\u00a0€')
    expect(m.text).toContain('https://tiroir.app/u/marie-dupont')
    expect(m.html).toContain('href="https://tiroir.app/desinscription?t=abc"')
    expect(m.html).not.toMatch(/\{\w+\}/)
    expect(m.text).not.toMatch(/\{\w+\}/)
  })

  test('aucune mention interdite, aucune date ni palier périmés', () => {
    const tous = [
      ...(['launch', 'reminder', 'last48h', 'recap'] as const).map(k => renderCampaign(k, base).text),
      renderThanks({ prenom: 'Marie' }).text,
    ]
    for (const text of tous) {
      expect(text).not.toMatch(/famille|carte postale|t-shirt|soirée|15 décembre|palier|\bdons?\b/i)
    }
  })

  test('relance : la jauge quand Ulule répond, rien sinon', () => {
    expect(renderCampaign('reminder', base).text).toContain('On en est à 1\u00a0250\u00a0€, sur un objectif de 4\u00a0000\u00a0€.')
    const blind = renderCampaign('reminder', { ...base, montant: null })
    expect(blind.text).not.toContain('On en est')
    expect(blind.html).not.toMatch(/\{\w+\}/)
  })

  test('48 h : jour de fin, objectif dépassé', () => {
    const m = renderCampaign('last48h', { ...base, montant: '4\u00a0200\u00a0€', objectifAtteint: true })
    expect(m.text).toContain('se termine lundi 21 décembre.')
    expect(m.text).toContain('l’objectif de 4\u00a0000\u00a0€ est dépassé')
  })

  test('bilan à un contributeur : sans lien perso, sans prénom, pied « stop »', () => {
    const m = renderCampaign('recap', { ...base, prenom: '', lien: null, desinscription: null })
    expect(m.text).toMatch(/^Salut,/)
    expect(m.text).toContain('Ensemble, on a réuni 1\u00a0250\u00a0€.')
    expect(m.text).toContain('réponds simplement « stop »')
    expect(m.html).not.toContain('/u/')
    expect(m.html).not.toMatch(/\{\w+\}/)
  })

  test('un prénom ne peut pas injecter de HTML', () => {
    expect(renderCampaign('launch', { ...base, prenom: 'Marie <b>' }).html).toContain('Marie &lt;b&gt;')
  })
})
