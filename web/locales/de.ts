// Généré par design/generate.mjs depuis design/i18n/site/de.json — ne pas modifier à la main.
//
// Texte der Website auf Deutsch. Gleiche Struktur wie fr.ts.
// Von einer Muttersprachlerin / einem Muttersprachler gegenlesen lassen.
import type { Copy } from './fr'
import share from './share/de'
import account from './account/de'
import about from './about/de'
import legal from './legal/de'

const de: Copy = {
  share,
  account,
  about,
  legal,
  layout: {
    pricing: 'Preise',
    download: 'App herunterladen',
    myProfile: 'Mein Profil',
    myAccount: 'Mein Konto',
    myShares: 'Meine Freigaben',
    signOut: 'Abmelden',
    signUp: 'Konto erstellen',
    signIn: 'Anmelden',
    newHere: 'Neu bei Tiroir?',
    openMenu: 'Menü öffnen',
    closeMenu: 'Menü schließen',
    footerTagline: 'Fotografiere deine Sachen, Tiroir schreibt den Eintrag. Dein Inventar, endlich aktuell.',
    product: 'Produkt',
    project: 'Das Projekt',
    about: 'Über uns',
    bookSlot: 'Termin buchen',
    bookSubject: 'Gespräch über Tiroir',
    legal: 'Rechtliches',
    terms: 'AGB',
    privacy: 'Datenschutz',
    madeIn: 'Made in France',
    contact: 'Kontakt',
    language: 'Sprache',
  },
  home: {
    meta: {
      title: 'Tiroir — ein Foto, und alles ist erfasst',
      description: 'Fotografiere einen Gegenstand: Tiroir schreibt den Eintrag, ordnet ihn ein und schätzt seinen Wert. Für Kreative, Profis und alle, die wissen wollen, was sie besitzen.',
    },
    hero: {
      badge: 'Für iOS und Android',
      variants: [
        {
          title: 'Ein Foto – und alles, was du besitzt, ist erfasst.',
          sub: 'Tiroir schreibt für jeden Gegenstand den Eintrag – mit Kategorie, Zustand und Wert.',
        },
        {
          title: 'Wissen, was du hast. Und was es wert ist.',
          sub: 'Tiroir schreibt für jeden Gegenstand den Eintrag – mit Kategorie, Zustand und Wert.',
        },
        {
          title: 'Dein Inventar erledigt sich von selbst.',
          sub: 'Ein Foto genügt, Tiroir kümmert sich um den Rest. Ganz ohne Technikkenntnisse.',
        },
      ],
      free: 'Kostenlos starten',
      demoLabel: 'Demo: Aus dem Foto einer Uhr wird ein vollständiger Eintrag mit geschätztem Wert.',
      steps: ['Foto', 'Eintrag', 'Wert'],
      object: {
        ready: 'Eintrag fertig',
        name: 'Vintage-Uhr',
        meta: '1970er · Edelstahl',
        rows: [
          ['Kategorie', 'Uhren'],
          ['Sammlung', 'Vitrine'],
          ['Zustand', 'Sehr gut'],
        ],
        valueLabel: 'Geschätzter Wert',
      },
    },
    photo: {
      title: 'Ein Foto. Das war’s.',
      sub: 'Torix, die KI von Tiroir, erkennt deinen Gegenstand und füllt seinen Eintrag aus. Du wählst nur die Schublade.',
      steps: [
        {
          title: 'Du machst das Foto',
          text: 'Ein Gegenstand, ein Foto. Kein Formular.',
        },
        {
          title: 'Torix füllt den Eintrag aus',
          text: 'Name, Kategorie, Zustand: Alles schreibt sich von selbst. Korrigiere, wenn du willst.',
        },
        {
          title: 'Schon eingeräumt',
          text: 'Du wählst die Schublade, während Torix arbeitet. Danach findest du alles sofort.',
        },
      ],
      fiche: {
        name: 'Jeansjacke',
        rows: [
          ['Kategorie', 'Kleidung'],
          ['Zustand', 'Gut'],
        ],
        estimate: 'Wert',
        estimateCta: '✦ Schätzen',
      },
      drawer: 'Garderobe',
      stored: 'Eingeräumt',
      video: {
        label: 'Demovideo: Aus dem Foto eines Gegenstands wird ein vollständiger Eintrag, eingeräumt in eine Schublade.',
        badge: '10 Sekunden',
        play: 'Video abspielen',
        pause: 'Video pausieren',
      },
      reassure: 'Kostenlos, ohne Kreditkarte. {n} KI-Aktionen pro Monat inklusive.',
      cta: 'Kostenlos testen',
    },
    creatives: {
      eyebrow: 'Für Kreative',
      title: 'Ihre Ausrüstung im Griff.',
      sub: 'Kameras, Objektive, Garderobe: Sie wissen, was Sie haben, wo es liegt und was es wert ist.',
      soon: 'Demnächst',
      points: [
        {
          title: 'Alles wiederfinden',
          text: 'Jedes Stück ist fotografiert und nach Sammlung geordnet. Finden Sie es vor einem Dreh in wenigen Sekunden.',
        },
        {
          title: 'Den Wert kennen',
          text: 'Torix wird jedes Stück automatisch schätzen, und eine Kurve wird seinen Wert im Zeitverlauf verfolgen.',
          soon: true,
        },
        {
          title: 'Sicher teilen',
          text: 'Senden Sie einer Assistenz oder einem Verleih eine schreibgeschützte Liste, ohne sonst etwas preiszugeben.',
        },
      ],
      card: {
        label: 'Vorschau: der Eintrag einer Kamera, mit ihrer Schätzung und der Kurve ihres Werts über zwölf Monate.',
        preview: 'Vorschau',
        name: 'Analoge Kamera',
        meta: 'Sammlung Dreh · eingeräumt',
        estimateLabel: 'Torix-Schätzung',
        trendLabel: 'Wert über 12 Monate',
      },
      bridge: 'Sie brauchen einen Export für Ihre Versicherung oder möchten einen ganzen Bestand auf einmal schätzen?',
      bridgeLink: 'Entdecken Sie den Pro-Tarif.',
      cta: 'Premium entdecken',
      ctaNote: 'Geplanter Tarif: Preise und Details auf der Preisseite.',
    },
    pro: {
      eyebrow: 'Für Fachleute',
      badge: 'Kommende Tarife',
      title: 'Ihr Inventar, ein kontrollierter Vermögenswert.',
      sub: 'Sie werden den Wert Ihres gesamten Bestands schätzen, dokumentieren und belegen können.',
      points: [
        {
          title: 'KI inklusive',
          text: 'Die KI-Credits werden in Ihrem Tarif enthalten sein, ohne Nachkaufen. Torix wird jeden Gegenstand automatisch schätzen.',
        },
        {
          title: 'Sammelschätzung',
          text: 'Sie werden einen ganzen Bestand in einem einzigen Vorgang schätzen.',
        },
        {
          title: 'Detaillierte Quellen',
          text: 'Sie werden die Quellen jeder Schätzung im Detail einsehen, um sie zu belegen.',
        },
        {
          title: 'Versicherungsexport',
          text: 'Sie werden einen Export erstellen, der direkt an Ihre Versicherung übermittelt werden kann.',
        },
      ],
      ctaPro: 'Pro-Tarif entdecken',
      ctaNote: 'Geplanter Tarif: Preise und Details auf der Preisseite.',
      business: {
        title: 'Für Unternehmen',
        text: 'Alle Pro-Funktionen, mit monatlicher Abrechnung auf Rechnung, per Überweisung oder Lastschrift.',
        cta: 'Kontakt aufnehmen',
      },
      preview: {
        label: 'Fiktive Vorschau eines Versicherungsexports: vier per Sammelschätzung bewertete Gegenstände und ihr Gesamtwert.',
        title: 'Versicherungsexport',
        tag: 'Fiktive Daten',
        subtitle: 'Technikbestand · Sammelschätzung',
        cols: ['Gegenstand', 'Kategorie', 'Wert'],
        rows: [
          ['Kinokamera', 'Bild'],
          ['35-mm-Objektiv', 'Optik'],
          ['Videostativ', 'Bühne'],
          ['Feldmonitor', 'Bild'],
        ],
        total: 'Geschätzter Gesamtwert',
      },
    },
    everyone: {
      eyebrow: 'Und für alle anderen',
      title: 'Kein Profi nötig. Kein Technikfreak auch nicht.',
      sub: 'Wer ein Foto machen kann, kann Tiroir nutzen.',
      points: [
        {
          title: 'Keine Vorkenntnisse nötig',
          text: 'Keine Tabellen, keine leeren Formulare. Du fotografierst, Tiroir füllt aus.',
        },
        {
          title: 'Deine Daten gehören dir',
          text: 'Keine Werbung, kein Weiterverkauf, kein Training von Modellen. Wer sein Konto löscht, löscht alles – sofort.',
        },
        {
          title: 'Teilen nur zum Ansehen',
          text: 'Ein Link zu einer Sammlung: Andere sehen sie ohne Konto und ohne App. Du deaktivierst den Link, wann du willst.',
        },
      ],
      usesTitle: 'Auch praktisch, um…',
      uses: [
        'Unterlagen für die Hausratversicherung vorzubereiten',
        'Umzuziehen, ohne etwas zu verlieren',
        'Preise für den Flohmarkt festzulegen',
        'Den Kleiderschrank auszumisten',
      ],
      why: 'Warum das funktioniert: Eine KI zur Bilderkennung beschreibt jedes Foto. Das Ergebnis bleibt ein Vorschlag – jedes Feld lässt sich ändern, und deine Korrekturen haben immer Vorrang.',
    },
    value: {
      eyebrow: 'Der Wert deiner Sachen',
      title: 'Wissen, was es wert ist – und dranbleiben.',
      sub: 'Eine Schätzung auf Basis vergleichbarer Angebote, keine Zahl aus dem Hut.',
      items: [
        {
          title: 'Schätzen',
          text: 'Eine Preisspanne – und die Angebote, aus denen sie stammt.',
        },
        {
          title: 'Verfolgen',
          text: 'Der Wert jedes Gegenstands und jeder Sammlung, aktualisiert, wann du willst.',
        },
        {
          title: 'Verkaufen',
          text: 'Als „Verkauft“ markieren, mit dem echten Preis: Der Gegenstand bleibt in deinem Verlauf.',
        },
      ],
      note: 'Kein Gutachten: Bei seltenen Stücken ist es eine Größenordnung.',
      demo: {
        comparable: 'Vergleichbares Angebot',
        sold: 'Verkauft',
        trend: 'Wert der Sammlung',
      },
    },
    pricing: {
      eyebrow: 'Preise',
      title: 'Kostenlos starten.',
      sub: 'Wechsle in einen höheren Tarif, wenn du ihn brauchst.',
      perMonth: '/Monat',
      perSeat: 'pro Platz/Monat',
      plans: {
        free: 'Unbegrenzt viele Gegenstände und Sammlungen, {n} Analysen pro Monat.',
        premium: 'Den Wert Ihrer Sammlung im Blick behalten.',
        pro: 'Für alle, die von ihren Gegenständen leben.',
        business: 'Bestände im Team verwalten.',
      },
      note: 'Preise inkl. MwSt.',
      details: 'Alle Tarife im Detail',
    },
    faq: {
      title: 'Häufige Fragen',
      items: [
        {
          q: 'Muss ich mich mit Technik auskennen?',
          a: 'Nein. Du machst ein Foto, Tiroir füllt den Eintrag aus. Alles lässt sich mit einem Tippen ändern.',
        },
        {
          q: 'Und wenn der Eintrag falsch ist?',
          a: 'Jedes Feld ist bearbeitbar, und deine Korrekturen haben immer Vorrang. Die genaue Marke oder den Kaufpreis kennst nur du.',
        },
        {
          q: 'Sind meine Fotos privat?',
          a: 'Ja. Nichts ist öffentlich, solange du keinen Link teilst – und den kannst du jederzeit deaktivieren.',
        },
        {
          q: 'Wie zuverlässig ist die Schätzung?',
          a: 'Sie basiert auf vergleichbaren Angeboten: ein verlässlicher Startpreis für gängige Dinge, eine Größenordnung für seltene Stücke.',
        },
      ],
    },
    final: {
      title: 'Dein erster Gegenstand, erfasst mit einem Foto.',
      sub: 'Kostenlos, ohne Kreditkarte.',
    },
  },
  pricing: {
    meta: {
      title: 'Preise — Tiroir',
      description: 'Tiroir ist kostenlos, mit {free} KI-Aktionen pro Monat. KI-Credits ab {pack}, Premium für {premium} pro Monat, Pro für {pro} pro Monat, Business auf Anfrage.',
    },
    badge: 'Preise',
    title: 'Alles erfasst. Wissen, was es wert ist.',
    sub: 'Tiroir ist für alle kostenlos. Du zahlst nur, wenn du mehr willst.',
    perMonth: '/Monat',
    perYear: 'oder {price} pro Jahr',
    perSeat: 'pro Platz/Monat',
    soon: 'Demnächst verfügbar',
    free: {
      tagline: 'Um alles zu erfassen, was du besitzt.',
      features: [
        'Unbegrenzt viele Gegenstände und Sammlungen',
        '{n} KI-Aktionen pro Monat (Erkennung, Schätzung)',
        'Sammlungen nur zum Ansehen teilen',
        'Zusätzliche KI-Credits bei Bedarf',
      ],
      start: 'Kostenlos starten',
      afterQuota: 'Monatliches KI-Kontingent, danach Credits kaufen',
    },
    premium: {
      tagline: 'Um den Wert Ihrer Sammlung im Blick zu behalten.',
      features: [
        'Automatische Schätzung mit Monatskontingent',
        'Wertverlauf als Kurve und Aktualisieren-Button',
        'Quellen in einer Zeile zusammengefasst',
        'Passwortgeschützte Freigabelinks',
      ],
      cta: 'Zu Premium wechseln',
    },
    pro: {
      tagline: 'Für alle, die von ihren Gegenständen leben.',
      features: [
        'KI inklusive, ohne Nachkaufen',
        'Schätzung im Stapel',
        'Detaillierte Quellen und Marktvergleich',
        'Export für die Versicherung',
      ],
      cta: 'Zu Pro wechseln',
    },
    business: {
      tagline: 'Um Bestände im Team zu verwalten.',
      features: [
        'Alles aus Pro, für jedes Mitglied',
        'Rollen und mehrere Konten',
        'Monatliche Rechnung, Überweisung oder Lastschrift',
      ],
      cta: 'Kontakt aufnehmen',
      quote: 'Auf Anfrage',
      billing: 'Monatliche Rechnung',
    },
    note: 'Preise inkl. MwSt. Business wird per Rechnung bezahlt.',
    credits: {
      title: 'KI-Credits',
      sub: 'Mehr nötig? Lade jederzeit auf, ohne Abo.',
      unit: '{n} Credits',
      popular: 'Am beliebtesten',
      note: 'Sichere Kartenzahlung. Credits verfallen nicht.',
      cta: 'Credits kaufen',
    },
    faqTitle: 'Häufige Fragen',
    faq: [
      {
        q: 'Was ist eine KI-Aktion?',
        a: 'Die Erkennung oder Schätzung eines Gegenstands.',
      },
      {
        q: 'Was passiert, wenn mein Kontingent aufgebraucht ist?',
        a: 'Tiroir bleibt nutzbar; nur KI-Aktionen benötigen Credits.',
      },
      {
        q: 'Werden die Schätzungen von Partnern beeinflusst?',
        a: 'Nein. Die Schätzungen werden nie von unseren Partnern beeinflusst: Kaufangebote sind von der Wertschätzung getrennt.',
      },
      {
        q: 'Kann ich kündigen?',
        a: 'Jederzeit, im App Store, im Play Store oder in Ihrem Konto.',
      },
    ],
    final: {
      title: 'Kostenlos starten.',
      sub: 'Unbegrenzt viele Gegenstände und Sammlungen, {n} KI-Aktionen pro Monat. Keine Kreditkarte nötig.',
    },
    twoMonthsFree: 'Zwei Monate geschenkt',
    vatIncl: 'inkl. MwSt.',
    vatExcl: '{price} netto',
  },
  errors: {
    notFoundTitle: 'Seite nicht gefunden',
    notFoundText: 'Die gesuchte Seite existiert nicht oder wurde verschoben.',
    serverTitle: 'Serverfehler',
    serverText: 'Bei uns ist ein Problem aufgetreten. Bitte versuch es gleich noch einmal.',
    back: 'Zur Startseite',
  },
}

export default de
