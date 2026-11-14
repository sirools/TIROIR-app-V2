// Scénario Playwright du banc e2e de l'essai sans compte (lancé par run.sh).
import { execFileSync, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require(`${execSync('npm root -g').toString().trim()}/playwright`) }
const { chromium, devices } = pw
const BASE = `http://localhost:${process.env.PORT}`
const SHOTS = process.env.SHOTS
const results = []
const check = (name, ok, extra = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${name} ${extra}`) }
const db = q => execFileSync('psql', [process.env.E2E_DB, '-X', '-q', '-t', '-A', '-c', q], { encoding: 'utf8' }).trim()
const etat = async () => (await fetch('http://localhost:54321/__etat')).json()

const browser = await chromium.launch()
async function visitor() {
  const c = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' })
  const p = await c.newPage()
  p.on('pageerror', e => console.log('  [pageerror]', e.message))
  return p
}
const shot = (p, name) => p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, scale: 'css' })

// Deux « photos » : une vraie image (la page d'accueil) et un carré blanc minuscule.
const first = await visitor()
await first.goto(BASE)
const photo = { name: 'lampe.png', mimeType: 'image/png', buffer: await first.screenshot() }
const blank = { name: 'vide.png', mimeType: 'image/png', buffer: await first.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 } }) }
const give = (p, file) => p.locator('input[type=file]').nth(1).setInputFiles(file)

// ── A. Le parcours complet, sur téléphone ──────────────────────────
const cta = first.getByRole('link', { name: 'Range ton premier objet' })
check('accueil : le bouton « Range ton premier objet » est là', await cta.count() === 1)
await shot(first, '1-accueil')
await cta.click()
await first.waitForURL(u => u.pathname === '/essai')
await first.getByRole('button', { name: 'Prendre une photo' }).waitFor()
check('essai : la conservation de la photo est annoncée avant l’envoi', await first.getByText('supprimés automatiquement sous 48 heures').count() === 1)
await shot(first, '2-essai')

await first.waitForFunction(() => !document.querySelector('button.primary')?.disabled)
await give(first, blank)
await first.getByText('Torix n’a pas reconnu d’objet').waitFor()
check('photo sans objet : message clair, une autre photo reste possible', await first.getByRole('button', { name: 'Importer une photo' }).count() === 1)

const t0 = Date.now()
await give(first, photo)
await first.getByText('Estimation Torix').waitFor()
const seconds = (Date.now() - t0) / 1000
check('estimation affichée', (await first.locator('.price').innerText()).replace(/\s/g, ' ') === '120 €', `(${seconds.toFixed(1)} s, sans modèle)`)
check('fourchette affichée', (await first.locator('.range').innerText()).replace(/\s/g, ' ') === 'Entre 90 € et 150 €')
const order = await first.evaluate(() => {
  const label = document.querySelector('.estimate .torix'), price = document.querySelector('.price')
  return Boolean(label && price && (label.compareDocumentPosition(price) & Node.DOCUMENT_POSITION_FOLLOWING))
})
check('l’estimation de Torix d’abord, le prix ensuite', order)
check('date de suppression annoncée', await first.getByText(/seront supprimés automatiquement le \d+ novembre/).count() === 1)
await shot(first, '3-estimation')

await first.reload()
await first.getByText('Estimation Torix').waitFor()
check('retour sur la page : l’essai est repris, sans nouvelle estimation', (await etat()).estimate === 2)

const again = await first.evaluate(async () => {
  const r = await fetch('/api/essai/estimer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo: 'data:image/jpeg;base64,' + btoa('\xff\xd8\xff' + 'x'.repeat(4000)) }) })
  return { status: r.status, body: await r.json() }
})
check('une seule estimation par essai', again.status === 409 && again.body.error === 'ALREADY_ESTIMATED' && (await etat()).estimate === 2)
check('la table des essais est fermée au navigateur',
  await first.evaluate(async key => (await fetch('http://localhost:54321/storage/v1/object/trial-images/x.jpg', { headers: { Authorization: `Bearer ${key}` } })).status, 'anon') === 403)

await first.fill('#trial-location', 'Tiroir du bureau')
await first.getByRole('button', { name: 'Sauvegarder dans mon Tiroir' }).click()
await first.waitForURL(u => u.pathname === '/inscription')
check('inscription : retour prévu vers la sauvegarde', new URL(first.url()).searchParams.get('next') === '/essai/sauvegarde')
await first.getByText('pour garder ton objet').waitFor()
check('inscription : le texte parle de l’objet à garder', true)
check('inscription : plus de seconde question dans le formulaire', await first.locator('select').count() === 0)
await shot(first, '4-inscription')

await first.fill('input[type=email]', 'ana@test.fr')
await first.fill('input[type=password]', 'motdepasse')
await first.click('button[type=submit]')
await first.waitForURL(u => u.pathname === '/essai/sauvegarde')
await first.getByText('Tu utilises Tiroir…').waitFor()
const ana = db(`SELECT id FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles WHERE persona IS NOT NULL OR id::text LIKE 'eeee%')`)
const object = JSON.parse(db(`SELECT row_to_json(o) FROM public.objects o WHERE user_id = '${ana}'`) || 'null')
check('l’objet est au compte, sans rien ressaisir',
  object?.title === 'Lampe de bureau' && object.location_note === 'Tiroir du bureau' && Number(object.market_value) === 120)
const image = db(`SELECT storage_path FROM public.object_images WHERE object_id = '${object?.id}' AND is_cover`)
let state = await etat()
check('la photo a suivi dans le stockage du compte', state.files.includes(`object-images/${image}`))
check('la photo d’essai est supprimée', !state.files.some(f => f.startsWith('trial-images/')))
check('une question, trois réponses', await first.locator('button.option').count() === 3)
await shot(first, '5-profil')

await first.getByRole('button', { name: /Pour mon activité de créatif/ }).click()
await first.waitForURL(u => u.pathname === `/mes-collections/objets/${object.id}`)
check('profil enregistré en un tap (droit du compte sur sa colonne)', db(`SELECT user_profile FROM public.profiles WHERE id = '${ana}'`) === 'creative')
await first.getByRole('heading', { name: 'Lampe de bureau' }).waitFor()
check('fiche objet : estimation et fourchette', await first.getByText('Fourchette : 90 € à 150 €.').count() === 1)
await shot(first, '6-fiche')

await first.goto(`${BASE}/essai/sauvegarde`)
check('recharger la sauvegarde ne crée pas de second objet', db(`SELECT count(*) FROM public.objects WHERE user_id = '${ana}'`) === '1')

// ── B. E-mail confirmé sur un autre appareil ───────────────────────
const phone = await visitor()
await phone.goto(`${BASE}/essai`)
await phone.waitForFunction(() => !document.querySelector('button.primary')?.disabled)
await give(phone, photo)
await phone.getByText('Estimation Torix').waitFor()
await phone.getByRole('button', { name: 'Sauvegarder dans mon Tiroir' }).click()
await phone.waitForURL(u => u.pathname === '/inscription')
await phone.fill('input[type=email]', 'confirme@test.fr')
await phone.fill('input[type=password]', 'motdepasse')
await phone.click('button[type=submit]')
await phone.getByText('confirme@test.fr').first().waitFor()
state = await etat()
const pending = state.users.find(u => u.email === 'confirme@test.fr')
check('inscription en attente : le code de rattachement suit le compte', /^[\w-]{43}$/.test(pending.user_metadata.trial ?? ''))
check('inscription en attente : l’essai est gardé 7 jours',
  db(`SELECT expires_at > now() + interval '6 days' FROM public.trial_objects WHERE signup_pending_at IS NOT NULL AND status = 'estimated'`) === 't')

const laptop = await (await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'fr-FR' })).newPage()
await laptop.goto(`${BASE}/login?next=/accueil`)
await laptop.fill('input[type=email]', 'confirme@test.fr')
await laptop.fill('input[type=password]', 'motdepasse')
await laptop.click('button[type=submit]')
await laptop.waitForURL(u => u.pathname === '/essai/sauvegarde')
await laptop.getByText('Tu utilises Tiroir…').waitFor()
check('autre appareil, sans cookie : l’objet est quand même rattaché',
  db(`SELECT count(*) FROM public.objects WHERE user_id = '${pending.id}'`) === '1')
check('le code des métadonnées est effacé après usage', (await etat()).users.find(u => u.id === pending.id).user_metadata.trial === null)
await shot(laptop, '7-autre-appareil')

// ── C. Anti-abus : plafond par adresse IP (3 essais par 24 h) ──────
const third = await visitor()
await third.goto(`${BASE}/essai`)
await third.waitForFunction(() => !document.querySelector('button.primary')?.disabled)
await give(third, photo)
await third.getByText('Estimation Torix').waitFor()
const fourth = await visitor()
await fourth.goto(`${BASE}/essai`)
await fourth.waitForFunction(() => !document.querySelector('button.primary')?.disabled)
const before = (await etat()).estimate
await give(fourth, photo)
await fourth.getByText('Tu as déjà fait plusieurs essais aujourd’hui').waitFor()
check('4e essai depuis la même adresse : refusé, sans appel à l’estimation', (await etat()).estimate === before)
check('4e essai : la création de compte est proposée', await fourth.getByRole('link', { name: 'Créer mon compte gratuit' }).count() === 1)
await shot(fourth, '8-plafond')
check('compteurs du jour', db(`SELECT started || '/' || estimated || '/' || claimed FROM public.trial_daily_stats`) === '3/3/2')

await browser.close()
const failed = results.filter(r => !r).length
console.log(`\n${results.length - failed}/${results.length} vérifications passent`)
process.exit(failed ? 1 : 0)
