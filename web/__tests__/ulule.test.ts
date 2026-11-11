import { describe, expect, test } from 'vitest'
import {
  campaignUrl, firstNameOf, formatLaunchDate, parisInputToIso, parseAmbassadorLines, parseAmountCents,
  parseCsv, parseExport, parseOrderDate, referrerOrigin, toParisInput, uniqueSlug,
} from '../lib/ulule'
import { renderPrelaunch, renderThanks } from '../lib/ululeEmails'

describe('ambassadeurs', () => {
  test('slug sans accent, puis suffixe en cas de doublon', () => {
    const taken = new Set<string>()
    expect(uniqueSlug('Éloïse', 'Le Gall', taken)).toBe('eloise-le-gall')
    expect(uniqueSlug('Eloise', 'le gall', taken)).toBe('eloise-le-gall-2')
  })

  test('une personne par ligne, les lignes illisibles sont rendues', () => {
    const { valid, invalid } = parseAmbassadorLines('Marie, Dupont, MARIE@Exemple.fr\nJean;jean@exemple.fr\nsans adresse, ni rien')
    expect(valid).toEqual([
      { firstName: 'Marie', lastName: 'Dupont', email: 'marie@exemple.fr' },
      { firstName: 'Jean', lastName: '', email: 'jean@exemple.fr' },
    ])
    expect(invalid).toEqual(['sans adresse, ni rien'])
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
