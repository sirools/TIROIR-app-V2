// Sidens tekster på dansk. Samme struktur som fr.ts.
// Skal gennemlæses af en person med dansk som modersmål.
import type { Copy } from './fr'

const da: Copy = {
  layout: {
    pricing: 'Priser',
    download: 'Hent appen',
    myProfile: 'Min profil',
    myAccount: 'Min konto',
    myShares: 'Mine delinger',
    signOut: 'Log ud',
    signUp: 'Opret konto',
    signIn: 'Log ind',
    newHere: 'Ny hos Tiroir?',
    openMenu: 'Åbn menuen',
    closeMenu: 'Luk menuen',
    footerTagline: 'Tag et billede af dine ting, Tiroir skriver beskrivelsen. Dit inventar, endelig opdateret.',
    product: 'Produkt',
    project: 'Projektet',
    about: 'Om os',
    bookSlot: 'Book en tid',
    bookSubject: 'Snak om Tiroir',
    legal: 'Juridisk',
    terms: 'Vilkår',
    privacy: 'Privatliv',
    madeIn: 'Lavet i Frankrig',
    contact: 'Kontakt',
    language: 'Sprog',
  },

  home: {
    meta: {
      title: 'Tiroir — ét billede, og dine ting er på plads',
      description: 'Tag et billede af en genstand: Tiroir skriver beskrivelsen, sorterer den og vurderer dens værdi. Til kreative, professionelle og alle, der vil vide, hvad de ejer.',
    },
    hero: {
      badge: 'Fås til iOS og Android',
      variants: [
        {
          title: 'Ét billede, og alt, hvad du ejer, er på plads.',
          sub: 'Tiroir skriver beskrivelsen af hver genstand for dig – med kategori, stand og værdi.',
        },
        {
          title: 'Vid endelig, hvad du har – og hvad det er værd.',
          sub: 'Tiroir skriver beskrivelsen af hver genstand for dig – med kategori, stand og værdi.',
        },
        {
          title: 'Dit inventar laver sig selv.',
          sub: 'Tag et billede, Tiroir klarer resten. Ingen tekniske evner nødvendige.',
        },
      ],
      free: 'Gratis at komme i gang',
      demoLabel: 'Demo: et billede af et ur bliver til en komplet beskrivelse med anslået værdi.',
      steps: ['Billede', 'Beskrivelse', 'Værdi'],
      object: {
        ready: 'Beskrivelse klar',
        name: 'Vintage-ur',
        meta: '1970’erne · stål',
        rows: [
          ['Kategori', 'Ure'],
          ['Samling', 'Montre'],
          ['Stand', 'Meget god'],
        ],
        valueLabel: 'Anslået værdi',
      },
    },
    how: {
      eyebrow: 'Sådan virker det',
      title: 'Tre trin, intet at indstille.',
      steps: [
        { title: 'Tag et billede', text: 'Én genstand, ét billede. Eller hundrede på én gang i serietilstand.' },
        { title: 'Beskrivelsen skriver sig selv', text: 'Navn, kategori, materiale, stand: alt er udfyldt. Ret til, hvis du vil.' },
        { title: 'Alt er på plads', text: 'Samlinger, søgning, status: du finder alt, når som helst.' },
      ],
      fiche: { name: 'Cowboyjakke', rows: [['Kategori', 'Tøj'], ['Materiale', 'Denim'], ['Stand', 'God']] },
      collections: ['Garderobe', 'Til salg', 'Studie'],
      search: 'blå jakke',
    },
    pros: {
      eyebrow: 'Til kreative og professionelle',
      title: 'Mindre indtastning, mere tid til faget.',
      sub: 'Dit udstyr, dit lager, dine samlinger: dokumenteret med et par billeder, mens du arbejder.',
      personas: [
        { who: 'Stylist', text: 'Hvert stykke fotograferet og sorteret efter shoot. Du ved, hvad der er ude, og hvad der er kommet retur.', chip: 'Udlånt · retur fredag' },
        { who: 'Produktionsleder', text: 'Udstyret registreret før optagelsen og tjekket ved retur. Hele lageret i lommen.', chip: '42 dele · 3 udlånt' },
        { who: 'Genbrugshandler', text: 'En hel stand registreret på én gang med serietilstand – med en startpris på hvert stykke.', chip: 'Serie · 60 genstande' },
        { who: 'Musiker', text: 'Instrumenter og tilbehør dokumenteret, kvitteringer vedhæftet: klar til forsikring eller videresalg.', chip: 'Værdi ≈ {price}' },
      ],
    },
    everyone: {
      eyebrow: 'Og til alle andre',
      title: 'Du behøver ikke være professionel. Eller teknisk.',
      sub: 'Kan du tage et billede, kan du bruge Tiroir.',
      points: [
        { title: 'Ingen forkundskaber', text: 'Ingen regneark, ingen tomme formularer. Du tager billedet, Tiroir udfylder.' },
        { title: 'Dine data er dine', text: 'Ingen reklamer, intet videresælges eller bruges til at træne modeller. Sletter du din konto, forsvinder alt – med det samme.' },
        { title: 'Deling kun til visning', text: 'Et link til en samling: andre kan se den uden konto eller app. Du slår linket fra, når du vil.' },
      ],
      usesTitle: 'Den er også god til at…',
      uses: ['Forberede en sag til forsikringen', 'Flytte uden at miste noget', 'Prissætte til loppemarkedet', 'Rydde op i garderoben'],
      why: 'Derfor virker det: en kunstig intelligens til billedgenkendelse beskriver hvert billede. Resultatet er kun et forslag – alle felter kan rettes, og dine rettelser vinder altid.',
    },
    value: {
      eyebrow: 'Hvad dine ting er værd',
      title: 'Vid, hvad det er værd – og følg med.',
      sub: 'Et skøn baseret på sammenlignelige annoncer, ikke et tal grebet ud af luften.',
      items: [
        { title: 'Vurdér', text: 'Et prisinterval – og de annoncer, det bygger på.' },
        { title: 'Følg', text: 'Værdien af hver genstand og hver samling, opdateret når du vil.' },
        { title: 'Sælg videre', text: 'Markér som „Solgt“ med den faktiske pris: genstanden bliver i din historik.' },
      ],
      note: 'Det er ikke en professionel vurdering: for et sjældent stykke er det en størrelsesorden.',
      demo: { comparable: 'Lignende annonce', sold: 'Solgt', trend: 'Samlingens værdi' },
    },
    pricing: {
      eyebrow: 'Priser',
      title: 'Gratis at komme i gang.',
      sub: 'Skift til et større abonnement, når du har brug for det.',
      perMonth: '/md.',
      perSeat: 'pr. bruger/md.',
      plans: {
        free: 'Ubegrænset antal genstande og samlinger, {n} analyser om måneden.',
        premium: 'Hold øje med, hvad din samling er værd.',
        pro: 'Til dem, der lever af deres ting.',
        business: 'Styr et lager sammen som team.',
      },
      note: 'Priser inkl. moms.',
      details: 'Se alle abonnementer',
    },
    faq: {
      title: 'Ofte stillede spørgsmål',
      items: [
        { q: 'Skal jeg være god til teknik?', a: 'Nej. Du tager et billede, Tiroir udfylder beskrivelsen. Alt kan rettes med et tryk.' },
        { q: 'Hvad hvis beskrivelsen tager fejl?', a: 'Alle felter kan redigeres, og dine rettelser vinder altid. Det præcise mærke eller købsprisen kender kun du.' },
        { q: 'Er mine billeder private?', a: 'Ja. Intet er offentligt, før du deler et link – og det kan du slå fra når som helst.' },
        { q: 'Hvor pålideligt er skønnet?', a: 'Det bygger på sammenlignelige annoncer: en pålidelig startpris for almindelige ting, en størrelsesorden for sjældne stykker.' },
      ],
    },
    final: {
      title: 'Din første genstand, på plads med ét billede.',
      sub: 'Gratis, uden kreditkort.',
    },
  },
}

export default da
