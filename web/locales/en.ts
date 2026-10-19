// Site copy in English (UK, Ireland, US). Same structure as fr.ts.
import type { Copy } from './fr'

const en: Copy = {
  layout: {
    pricing: 'Pricing',
    download: 'Download the app',
    myProfile: 'My profile',
    myAccount: 'My account',
    myShares: 'My shares',
    signOut: 'Sign out',
    signUp: 'Sign up',
    signIn: 'Sign in',
    newHere: 'New to Tiroir?',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    footerTagline: 'Snap your things, Tiroir writes the entry. Your inventory, finally up to date.',
    product: 'Product',
    project: 'The project',
    about: 'About',
    bookSlot: 'Book a slot',
    bookSubject: 'Chat about Tiroir',
    legal: 'Legal',
    terms: 'Terms',
    privacy: 'Privacy',
    madeIn: 'Made in France',
    contact: 'Contact',
    language: 'Language',
  },

  // Achats dans l'app (page Tarifs) : Premium et crédits passent par les stores.
  inApp: {
    subscribe: 'Subscribe in the app',
    buyCredits: 'Buy credits in the app',
    subscriptionNote: 'Your subscription is managed in the app.',
    creditsNote: 'Credits are bought in the app.',
  },

  home: {
    meta: {
      title: 'Tiroir — one photo, and your things are sorted',
      description: 'Snap an item: Tiroir writes its entry, files it and estimates what it’s worth. For creatives, pros and anyone who wants to know what they own.',
    },
    hero: {
      badge: 'Available on iOS and Android',
      variants: [
        {
          title: 'One photo, and everything you own is sorted.',
          sub: 'Tiroir writes the entry for every item for you — category, condition and value included.',
        },
        {
          title: 'Finally know what you own, and what it’s worth.',
          sub: 'Tiroir writes the entry for every item for you — category, condition and value included.',
        },
        {
          title: 'Your inventory, done for you.',
          sub: 'Take a photo, Tiroir handles the rest. No technical skills needed.',
        },
      ],
      free: 'Free to start',
      demoLabel: 'Demo: a photo of a watch becomes a complete entry, with its estimated value.',
      steps: ['Photo', 'Entry', 'Value'],
      object: {
        ready: 'Entry ready',
        name: 'Vintage watch',
        meta: '1970s · steel',
        rows: [
          ['Category', 'Watches'],
          ['Collection', 'Display case'],
          ['Condition', 'Very good'],
        ],
        valueLabel: 'Estimated value',
      },
    },
    how: {
      eyebrow: 'How it works',
      title: 'Three steps. Nothing to set up.',
      steps: [
        { title: 'Snap it', text: 'One item, one photo. Or a hundred at once in burst mode.' },
        { title: 'The entry writes itself', text: 'Name, category, material, condition: all filled in. Tweak it if you like.' },
        { title: 'It’s sorted', text: 'Collections, search, status: find anything, any time.' },
      ],
      fiche: { name: 'Denim jacket', rows: [['Category', 'Clothing'], ['Material', 'Denim'], ['Condition', 'Good']] },
      collections: ['Wardrobe', 'To sell', 'Studio'],
      search: 'blue jacket',
    },
    pros: {
      eyebrow: 'For creatives and pros',
      title: 'Less admin, more of your actual job.',
      sub: 'Your kit, your stock, your collections: documented in a few photos, while you work.',
      personas: [
        { who: 'Stylist', text: 'Every piece photographed and filed by shoot. You know what went out and what came back.', chip: 'On loan · back Friday' },
        { who: 'Production manager', text: 'Kit logged before the shoot, checked on return. Your whole inventory fits in your pocket.', chip: '42 items · 3 on loan' },
        { who: 'Second-hand dealer', text: 'A full stall catalogued in one session with burst mode, with a starting price for every piece.', chip: 'Burst · 60 items' },
        { who: 'Musician', text: 'Instruments and gear documented, receipts attached: ready for insurance or resale.', chip: 'Value ≈ {price}' },
      ],
    },
    everyone: {
      eyebrow: 'And for everyone else',
      title: 'No need to be a pro. Or a techie.',
      sub: 'If you can take a photo, you can use Tiroir.',
      points: [
        { title: 'No skills required', text: 'No spreadsheets, no blank forms. You take the photo, Tiroir fills it in.' },
        { title: 'Your data stays yours', text: 'No ads, nothing sold on, nothing used to train models. Delete your account and everything goes, instantly.' },
        { title: 'Read-only sharing', text: 'Share a link to a collection: people can look, no account or app needed. Switch the link off whenever you like.' },
      ],
      usesTitle: 'It’s also great for…',
      uses: ['Putting together an insurance claim', 'Moving house without losing a thing', 'Pricing a garage sale', 'Clearing out a wardrobe'],
      why: 'Why it works: image-recognition AI describes each photo. The result is only a suggestion — every field can be edited, and your changes always win.',
    },
    value: {
      eyebrow: 'What your things are worth',
      title: 'Know what it’s worth, and keep track.',
      sub: 'An estimate based on comparable listings, not a number pulled out of thin air.',
      items: [
        { title: 'Estimate', text: 'A price range, plus the listings behind it.' },
        { title: 'Track', text: 'The value of every item and every collection, refreshed whenever you want.' },
        { title: 'Resell', text: 'Mark it “Sold” with the real price: the item stays in your history.' },
      ],
      note: 'It’s not a professional valuation: for a rare piece, treat it as a ballpark.',
      demo: { comparable: 'Similar listing', sold: 'Sold', trend: 'Collection value' },
    },
    pricing: {
      eyebrow: 'Pricing',
      title: 'Free to start.',
      sub: 'Upgrade when you need to.',
      perMonth: '/month',
      perSeat: 'per seat/month',
      plans: {
        free: 'Unlimited items and collections, {n} scans a month.',
        premium: 'Keep track of what your collection is worth.',
        pro: 'For people who make a living from their things.',
        business: 'Manage stock as a team.',
      },
      note: 'Prices include VAT.',
      details: 'See full plan details',
    },
    faq: {
      title: 'FAQ',
      items: [
        { q: 'Do I need to be good with tech?', a: 'No. You take a photo, Tiroir fills in the entry. Anything can be changed with a tap.' },
        { q: 'What if the entry gets something wrong?', a: 'Every field is editable, and your changes always win. The exact brand or what you paid — that’s something only you know.' },
        { q: 'Are my photos private?', a: 'Yes. Nothing is public unless you share a link, and you can switch it off at any time.' },
        { q: 'How reliable is the estimate?', a: 'It’s based on comparable listings: a solid starting price for everyday items, a ballpark for rare pieces.' },
      ],
    },
    final: {
      title: 'Your first item, sorted in one photo.',
      sub: 'Free, no card needed.',
    },
  },
}

export default en
