// Scénario Playwright du banc e2e des suggestions (lancé par run.sh).
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
// Playwright local au projet, sinon installé globalement.
let pw
try { pw = require('playwright') } catch { pw = require(`${execSync('npm root -g').toString().trim()}/playwright`) }
const { chromium } = pw
const BASE = 'http://localhost:3000'
const SHOTS = process.env.SHOTS
const phase = process.argv[2]
const results = []
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${name} ${extra}`) }
const browser = await chromium.launch()
async function ctx(email) {
  const c = await browser.newContext({ viewport: { width: 1200, height: 900 } })
  const p = await c.newPage()
  p.on('pageerror', e => console.log('  [pageerror]', e.message))
  if (email) {
    await p.goto(`${BASE}/login?next=/s/cuisine`)
    await p.fill('input[type=email]', email)
    await p.fill('input[type=password]', 'x')
    await p.click('button[type=submit]')
    await p.waitForURL(u => u.pathname === '/s/cuisine')
  }
  return p
}
const count = (p, sel) => p.locator(sel).count()

if (phase === 'before') {
  const anon = await ctx()
  await anon.goto(`${BASE}/s/cuisine`)
  check('sans 0003 : 2 objets affichés', await count(anon, '.grid > .card') === 2)
  check('sans 0003 : pas de bouton +', await count(anon, 'text=Suggérer un objet') === 0)
  await anon.screenshot({ path: `${SHOTS}/0-avant-visiteur.png`, fullPage: true })
  const ana = await ctx('ana@test.fr')
  check('sans 0003 : Ana connectée, pas de réglage', await count(ana, '[role=switch]') === 0)
  check('sans 0003 : pas de module de tri', await count(ana, 'text=Suggestions à trier') === 0)
}

if (phase === 'after') {
  // Propriétaire : réglage désactivé par défaut
  const ana = await ctx('ana@test.fr')
  check('réglage visible, désactivé par défaut', await ana.getAttribute('[role=switch]', 'aria-checked') === 'false')
  check('pas de module de tri sans suggestion', await count(ana, 'text=Suggestions à trier') === 0)
  check('le propriétaire n’a pas de bouton +', await count(ana, 'text=Suggérer un objet') === 0)
  await ana.screenshot({ path: `${SHOTS}/1-proprietaire-desactive.png` })

  // Visiteur anonyme, désactivé : comme avant
  const anon = await ctx()
  await anon.goto(`${BASE}/s/cuisine`)
  check('désactivé : pas de bouton + pour le visiteur', await count(anon, 'text=Suggérer un objet') === 0)

  await ana.click('[role=switch]')
  await ana.waitForSelector('[role=switch][aria-checked=true]')
  check('Ana active les suggestions', true)

  await anon.reload()
  await anon.click('text=Suggérer un objet')
  check('visiteur sans compte : modale d’inscription (stub)', await count(anon, '[data-todo=signup-modal]') === 1)
  await anon.screenshot({ path: `${SHOTS}/2-visiteur-sans-compte.png` })

  // Bob suggère
  const bob = await ctx('bob@test.fr')
  await bob.click('text=Suggérer un objet')
  await bob.fill('input[placeholder="Ex. : Couteau de chef"]', 'Couteau de chef')
  await bob.fill('input[placeholder="https://…"]', 'www.exemple.fr/couteau')
  await bob.fill('input[placeholder="Ex. : 49,90"]', '89,90')
  await bob.screenshot({ path: `${SHOTS}/3-formulaire.png` })
  await bob.click('text=Envoyer la suggestion')
  await bob.waitForSelector('text=Suggestion envoyée')
  check('Bob voit sa suggestion en fantôme', await count(bob, '.grid >> text=Couteau de chef') === 1)
  await bob.screenshot({ path: `${SHOTS}/4-bob-apres-suggestion.png`, fullPage: true })
  await bob.click('text=Suggérer un objet')
  await bob.fill('input[placeholder="Ex. : Couteau de chef"]', 'Mandoline')
  await bob.click('text=Envoyer la suggestion')
  await bob.waitForSelector('.grid >> text=Mandoline')

  const chloe = await ctx('chloe@test.fr')
  check('Chloé ne voit pas les suggestions en attente de Bob', await count(chloe, 'text=Couteau de chef') === 0)
  await chloe.click('text=Suggérer un objet')
  await chloe.fill('input[placeholder="Ex. : Couteau de chef"]', 'Planche à découper')
  await chloe.fill('input[placeholder="https://…"]', 'javascript:alert(1)')
  await chloe.click('text=Envoyer la suggestion')
  check('lien invalide refusé dans le formulaire', await count(chloe, 'text=Le lien doit commencer') === 1)
  await chloe.fill('input[placeholder="https://…"]', '')
  await chloe.click('text=Envoyer la suggestion')
  await chloe.waitForSelector('.grid >> text=Planche à découper')

  // Ana trie
  await ana.reload()
  check('module de tri : 3 en attente', (await ana.textContent('.count'))?.trim() === '3')
  check('grille : 3 fantômes avec auteur', await count(ana, '.grid >> text=Suggéré par') === 3)
  await ana.screenshot({ path: `${SHOTS}/5-proprietaire-a-trier.png`, fullPage: true })
  check('première carte = la plus ancienne', (await ana.textContent('.card.top h3')) === 'Couteau de chef')
  // Glisser à droite à la souris
  const box = await ana.locator('.card.top').boundingBox()
  await ana.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await ana.mouse.down()
  for (let i = 1; i <= 10; i++) await ana.mouse.move(box.x + box.width / 2 + i * 20, box.y + box.height / 2)
  await ana.screenshot({ path: `${SHOTS}/6-glisser.png` })
  await ana.mouse.up()
  await ana.waitForFunction(() => document.querySelector('.card.top h3')?.textContent === 'Mandoline')
  check('glisser à droite : gardée', true)
  await ana.click('text=✕ Écarter')
  await ana.waitForFunction(() => document.querySelector('.card.top h3')?.textContent === 'Planche à découper')
  check('bouton Écarter', await count(ana, '.grid >> text=Mandoline') === 0)
  await ana.click('text=Annuler le dernier choix')
  await ana.waitForFunction(() => document.querySelector('.card.top h3')?.textContent === 'Mandoline')
  check('annuler : Mandoline revient', await count(ana, '.grid >> text=Mandoline') === 1)
  await ana.waitForSelector('.btn-keep:not([disabled])')
  await ana.keyboard.press('ArrowLeft')
  await ana.waitForFunction(() => document.querySelector('.card.top h3')?.textContent === 'Planche à découper')
  await ana.waitForSelector('.btn-keep:not([disabled])')
  await ana.click('text=♥ Garder')
  await ana.waitForSelector('text=Tout est trié')
  await ana.waitForSelector('.undo:not([disabled])')
  check('tout trié : annulation encore possible', await ana.isEnabled('text=Annuler le dernier choix'))
  await ana.screenshot({ path: `${SHOTS}/7-tout-trie.png`, fullPage: true })
  await ana.reload()
  await ana.waitForLoadState('networkidle')
  check('après rechargement : module masqué', await count(ana, 'text=Tout est trié') + await count(ana, 'text=Suggestions à trier') === 0)
  check('idées gardées en grille', await count(ana, '.grid >> text=Idée') === 2)

  await bob.reload()
  check('Bob voit l’idée validée, plus la suggestion écartée', await count(bob, '.grid >> text=Couteau de chef') === 1 && await count(bob, '.grid >> text=Mandoline') === 0)

  // Lien protégé
  const bob2 = await ctx('bob@test.fr')
  await bob2.goto(`${BASE}/s/secret`)
  check('lien protégé : mot de passe demandé', await count(bob2, 'text=Partage protégé') === 1)
  await bob2.fill('input[type=password]', 'tiroir')
  await bob2.click('text=Valider')
  await bob2.waitForSelector('text=Suggérer un objet')
  await bob2.click('text=Suggérer un objet')
  check('cookie signé : formulaire direct', await count(bob2, 'text=Envoyer la suggestion') === 1)
  await bob2.fill('input[placeholder="Ex. : Couteau de chef"]', 'Fouet')
  await bob2.click('text=Envoyer la suggestion')
  await bob2.waitForSelector('.grid >> text=Fouet')
  check('suggestion via lien protégé', true)

  // Ancien cookie (non signé, fabricable) : lecture ok, écriture exige le mot de passe
  const forged = await browser.newContext()
  const fp = await forged.newPage()
  await fp.goto(`${BASE}/login?next=/s/secret`)
  await fp.fill('input[type=email]', 'chloe@test.fr'); await fp.fill('input[type=password]', 'x'); await fp.click('button[type=submit]')
  await fp.waitForURL(u => u.pathname === '/s/secret')
  await forged.addCookies([{ name: 'tiroir_share_secret', value: `${Date.now()}.ok`, url: BASE }])
  await fp.reload()
  await fp.waitForLoadState('networkidle')
  check('ancien cookie : la page s’ouvre comme avant', await count(fp, 'text=Suggérer un objet') === 1)
  await fp.click('text=Suggérer un objet')
  check('ancien cookie : mot de passe exigé pour suggérer', await count(fp, 'text=Confirme le mot de passe') === 1)
  const status = await fp.evaluate(async () => (await fetch('/api/shares/secret/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Hack' }) })).status)
  check('ancien cookie : API refuse (403)', status === 403, String(status))

  // Visiteur sans compte : API refuse
  const st = await anon.evaluate(async () => (await fetch('/api/shares/cuisine/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'X' }) })).status)
  check('API sans compte : 401', st === 401, String(st))

  // Désactivation : retour à l'identique pour les visiteurs
  await ana.click('[role=switch]')
  await ana.waitForSelector('[role=switch][aria-checked=false]')
  await bob.reload()
  check('désactivé : plus de bouton ni de fantômes pour le visiteur', await count(bob, 'text=Suggérer un objet') === 0 && await count(bob, '.grid > .card') === 2)
  const st2 = await bob.evaluate(async () => (await fetch('/api/shares/cuisine/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'X' }) })).status)
  check('désactivé : API refuse (403)', st2 === 403, String(st2))

  // Mobile : module de tri au doigt
  execSync(`psql "${process.env.E2E_DB}" -qc "UPDATE collection_wishes SET status='suggested', decided_at=null WHERE title='Mandoline'"`)
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const mp = await m.newPage()
  await mp.goto(`${BASE}/login?next=/s/cuisine`)
  await mp.fill('input[type=email]', 'ana@test.fr'); await mp.fill('input[type=password]', 'x'); await mp.click('button[type=submit]')
  await mp.waitForURL(u => u.pathname === '/s/cuisine')
  await mp.screenshot({ path: `${SHOTS}/8-mobile.png`, fullPage: true })
}
await browser.close()
const failed = results.filter(r => !r).length
console.log(`\n${results.length - failed} réussis, ${failed} échecs`)
process.exit(failed ? 1 : 0)
