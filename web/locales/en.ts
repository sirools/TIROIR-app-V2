// Généré par design/generate.mjs depuis design/i18n/site/en.json — ne pas modifier à la main.
//
// Site copy in English (UK, Ireland, US). Same structure as fr.ts.
import type { Copy } from './fr'
import share from './share/en'
import account from './account/en'
import about from './about/en'
import legal from './legal/en'

const en: Copy = {
  share,
  account,
  about,
  legal,
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
    photo: {
      title: 'One photo. That’s it.',
      sub: 'Torix, Tiroir’s AI, recognises your item and fills in its entry. All you do is pick the drawer.',
      steps: [
        {
          title: 'You take the photo',
          text: 'One item, one photo. No form to fill in.',
        },
        {
          title: 'Torix fills in the entry',
          text: 'Name, category, condition: it all writes itself. Edit it if you like.',
        },
        {
          title: 'It’s put away',
          text: 'Pick the drawer while Torix works. Then find anything in a second.',
        },
      ],
      fiche: {
        name: 'Denim jacket',
        rows: [
          ['Category', 'Clothing'],
          ['Condition', 'Good'],
        ],
        estimate: 'Value',
        estimateCta: '✦ Estimate',
      },
      drawer: 'Wardrobe',
      stored: 'Stored',
      video: {
        label: 'Demo video: a photo of an item becomes a complete entry, put away in a drawer.',
        badge: '10 seconds',
        play: 'Play the video',
        pause: 'Pause the video',
      },
      reassure: 'Free, no credit card. {n} AI actions a month included.',
      cta: 'Try it free',
    },
    creatives: {
      eyebrow: 'For creatives',
      title: 'Your kit, under control.',
      sub: 'Cameras, lenses, wardrobe pieces: know what you have, where it is, and what it’s worth.',
      soon: 'Coming soon',
      points: [
        {
          title: 'Find everything',
          text: 'Every piece is photographed and filed by collection. Find it in seconds before a shoot.',
        },
        {
          title: 'Know its value',
          text: 'Torix will value every piece automatically, and a chart will track its value over time.',
          soon: true,
        },
        {
          title: 'Share safely',
          text: 'Send a read-only list to an assistant or a rental house, without exposing anything else.',
        },
      ],
      card: {
        label: 'Preview: a camera’s entry, with its estimate and a chart of its value over twelve months.',
        preview: 'Preview',
        name: 'Film camera',
        meta: 'Shoot collection · stored',
        estimateLabel: 'Torix estimate',
        trendLabel: 'Value over 12 months',
      },
      bridge: 'Need an export for your insurer, or to value a whole kit at once?',
      bridgeLink: 'Discover the Pro plan.',
      cta: 'Discover Premium',
      ctaNote: 'Upcoming plan: prices and details on the Pricing page.',
    },
    pro: {
      eyebrow: 'For professionals',
      badge: 'Upcoming plans',
      title: 'Your inventory, a managed asset.',
      sub: 'You will be able to value, document and justify the worth of your entire equipment.',
      points: [
        {
          title: 'AI included',
          text: 'AI credits will be included in your plan, with no top-ups to manage. Torix will value every item automatically.',
        },
        {
          title: 'Batch valuation',
          text: 'You will value an entire inventory in a single operation.',
        },
        {
          title: 'Detailed sources',
          text: 'You will see the detailed sources behind every estimate, to justify it.',
        },
        {
          title: 'Insurance export',
          text: 'You will generate an export ready to send to your insurer.',
        },
      ],
      ctaPro: 'Discover the Pro plan',
      ctaNote: 'Upcoming plan: prices and details on the Pricing page.',
      business: {
        title: 'For companies',
        text: 'Every Pro feature, with monthly invoicing, paid by bank transfer or direct debit.',
        cta: 'Contact us',
      },
      preview: {
        label: 'Sample insurance export: four items valued in a batch, with their total value.',
        title: 'Insurance export',
        tag: 'Sample data',
        subtitle: 'Equipment · batch valuation',
        cols: ['Item', 'Category', 'Value'],
        rows: [
          ['Cinema camera', 'Camera'],
          ['35 mm lens', 'Optics'],
          ['Video tripod', 'Grip'],
          ['Field monitor', 'Camera'],
        ],
        total: 'Estimated total',
      },
    },
    everyone: {
      eyebrow: 'And for everyone else',
      title: 'No need to be a pro. Or a techie.',
      sub: 'If you can take a photo, you can use Tiroir.',
      points: [
        {
          title: 'No skills required',
          text: 'No spreadsheets, no blank forms. You take the photo, Tiroir fills it in.',
        },
        {
          title: 'Your data stays yours',
          text: 'No ads, nothing sold on, nothing used to train models. Delete your account and everything goes, instantly.',
        },
        {
          title: 'Read-only sharing',
          text: 'Share a link to a collection: people can look, no account or app needed. Switch the link off whenever you like.',
        },
      ],
      usesTitle: 'It’s also great for…',
      uses: [
        'Putting together an insurance claim',
        'Moving house without losing a thing',
        'Pricing a garage sale',
        'Clearing out a wardrobe',
      ],
      why: 'Why it works: image-recognition AI describes each photo. The result is only a suggestion — every field can be edited, and your changes always win.',
    },
    value: {
      eyebrow: 'What your things are worth',
      title: 'Know what it’s worth, and keep track.',
      sub: 'An estimate based on comparable listings, not a number pulled out of thin air.',
      items: [
        {
          title: 'Estimate',
          text: 'A price range, plus the listings behind it.',
        },
        {
          title: 'Track',
          text: 'The value of every item and every collection, refreshed whenever you want.',
        },
        {
          title: 'Resell',
          text: 'Mark it “Sold” with the real price: the item stays in your history.',
        },
      ],
      note: 'It’s not a professional valuation: for a rare piece, treat it as a ballpark.',
      demo: {
        comparable: 'Similar listing',
        sold: 'Sold',
        trend: 'Collection value',
      },
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
        {
          q: 'Do I need to be good with tech?',
          a: 'No. You take a photo, Tiroir fills in the entry. Anything can be changed with a tap.',
        },
        {
          q: 'What if the entry gets something wrong?',
          a: 'Every field is editable, and your changes always win. The exact brand or what you paid — that’s something only you know.',
        },
        {
          q: 'Are my photos private?',
          a: 'Yes. Nothing is public unless you share a link, and you can switch it off at any time.',
        },
        {
          q: 'How reliable is the estimate?',
          a: 'It’s based on comparable listings: a solid starting price for everyday items, a ballpark for rare pieces.',
        },
      ],
    },
    final: {
      title: 'Your first item, sorted in one photo.',
      sub: 'Free, no card needed.',
    },
  },
  pricing: {
    meta: {
      title: 'Pricing — Tiroir',
      description: 'Tiroir is free, with {free} AI actions a month. AI credits from {pack}, Premium at {premium} a month, Pro at {pro} a month, Business on quote.',
    },
    badge: 'Pricing',
    title: 'Sort everything. Know what it’s worth.',
    sub: 'Tiroir is free for everyone. Only pay when you want to go further.',
    perMonth: '/month',
    perYear: 'or {price} per year',
    perSeat: 'per seat/month',
    soon: 'Coming soon',
    free: {
      tagline: 'To catalogue everything you own.',
      features: [
        'Unlimited items and collections',
        '{n} AI actions a month (identification, estimates)',
        'Read-only collection sharing',
        'Extra AI credits, on demand',
      ],
      start: 'Start for free',
      afterQuota: 'Monthly AI quota, then buy credits',
    },
    premium: {
      tagline: 'To keep track of what your collection is worth.',
      features: [
        'Automatic estimates with a monthly quota',
        'Value tracking chart and Refresh button',
        'Sources summed up in one line',
        'Password-protected share links',
      ],
      cta: 'Go Premium',
    },
    pro: {
      tagline: 'For people who make a living from their things.',
      features: [
        'AI included, no top-ups',
        'Batch estimates',
        'Detailed sources and market comparison',
        'Insurance export',
      ],
      cta: 'Go Pro',
    },
    business: {
      tagline: 'To manage stock as a team.',
      features: [
        'Everything in Pro, for every member',
        'Roles and multiple accounts',
        'Monthly invoicing, bank transfer or direct debit',
      ],
      cta: 'Contact us',
      quote: 'Custom quote',
      billing: 'Monthly invoice',
    },
    note: 'Prices include VAT. Business is invoiced.',
    credits: {
      title: 'AI credits',
      sub: 'Need more? Top up whenever you like, no subscription.',
      unit: '{n} credits',
      popular: 'Most popular',
      note: 'Secure card payment. Credits never expire.',
      cta: 'Buy credits',
    },
    faqTitle: 'FAQ',
    faq: [
      {
        q: 'What is an AI action?',
        a: 'Identifying or estimating an item.',
      },
      {
        q: 'What happens when my quota runs out?',
        a: 'Tiroir keeps working; only AI actions need credits.',
      },
      {
        q: 'Are estimates influenced by partners?',
        a: 'No. Estimates are never influenced by our partners: shopping offers are kept separate from value estimates.',
      },
      {
        q: 'Can I cancel?',
        a: 'Any time, from the App Store, the Play Store or your account.',
      },
    ],
    final: {
      title: 'Start for free.',
      sub: 'Unlimited items and collections, {n} AI actions a month. No card required.',
    },
    twoMonthsFree: 'Two months free',
    vatIncl: 'incl. VAT',
    vatExcl: '{price} excl. VAT',
  },
  errors: {
    notFoundTitle: 'Page not found',
    notFoundText: 'The page you’re looking for doesn’t exist or has moved.',
    serverTitle: 'Server error',
    serverText: 'Something went wrong on our side. Please try again in a moment.',
    back: 'Back to home',
  },
}

export default en
