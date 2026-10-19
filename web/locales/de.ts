// Texte der Website auf Deutsch. Gleiche Struktur wie fr.ts.
// Von einer Muttersprachlerin / einem Muttersprachler gegenlesen lassen.
import type { Copy } from './fr'

const de: Copy = {
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
    footerTagline: 'Fotografieren Sie Ihre Sachen, Tiroir schreibt den Eintrag. Ihr Inventar, endlich aktuell.',
    product: 'Produkt',
    project: 'Das Projekt',
    about: 'Über uns',
    bookSlot: 'Termin buchen',
    bookSubject: 'Gespräch über Tiroir',
    legal: 'Rechtliches',
    terms: 'AGB',
    privacy: 'Datenschutz',
    madeIn: 'Made in France',
    language: 'Sprache',
  },

  home: {
    meta: {
      title: 'Tiroir — ein Foto, und alles ist erfasst',
      description: 'Fotografieren Sie einen Gegenstand: Tiroir schreibt den Eintrag, ordnet ihn ein und schätzt seinen Wert. Für Kreative, Profis und alle, die wissen wollen, was sie besitzen.',
    },
    hero: {
      badge: 'Für iOS und Android',
      variants: [
        {
          title: 'Ein Foto – und alles, was Sie besitzen, ist erfasst.',
          sub: 'Tiroir schreibt für jeden Gegenstand den Eintrag – mit Kategorie, Zustand und Wert.',
        },
        {
          title: 'Wissen, was Sie haben. Und was es wert ist.',
          sub: 'Tiroir schreibt für jeden Gegenstand den Eintrag – mit Kategorie, Zustand und Wert.',
        },
        {
          title: 'Ihr Inventar erledigt sich von selbst.',
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
    how: {
      eyebrow: 'So funktioniert’s',
      title: 'Drei Schritte, nichts einzurichten.',
      steps: [
        { title: 'Fotografieren', text: 'Ein Gegenstand, ein Foto. Oder hundert auf einmal im Serienmodus.' },
        { title: 'Der Eintrag schreibt sich', text: 'Name, Kategorie, Material, Zustand: alles ausgefüllt. Korrigieren Sie bei Bedarf.' },
        { title: 'Alles erfasst', text: 'Sammlungen, Suche, Status: Sie finden alles wieder, jederzeit.' },
      ],
      fiche: { name: 'Jeansjacke', rows: [['Kategorie', 'Kleidung'], ['Material', 'Denim'], ['Zustand', 'Gut']] },
      collections: ['Kleiderschrank', 'Zu verkaufen', 'Studio'],
      search: 'blaue Jacke',
    },
    pros: {
      eyebrow: 'Für Kreative und Profis',
      title: 'Weniger Tipparbeit, mehr Zeit für Ihren Job.',
      sub: 'Ihre Ausrüstung, Ihr Lager, Ihre Sammlungen: mit ein paar Fotos dokumentiert, während Sie arbeiten.',
      personas: [
        { who: 'Stylistin', text: 'Jedes Teil fotografiert und nach Shooting sortiert. Sie wissen, was rausging und was zurückkam.', chip: 'Verliehen · zurück am Freitag' },
        { who: 'Aufnahmeleiter', text: 'Die Technik vor dem Dreh erfasst, nach der Rückgabe geprüft. Der ganze Bestand passt in Ihre Hosentasche.', chip: '42 Teile · 3 verliehen' },
        { who: 'Trödelhändler', text: 'Ein ganzer Stand in einer Sitzung erfasst, dank Serienmodus – mit Startpreis für jedes Stück.', chip: 'Serie · 60 Objekte' },
        { who: 'Musiker', text: 'Instrumente und Zubehör dokumentiert, Rechnungen angehängt: bereit für Versicherung oder Verkauf.', chip: 'Wert ≈ {price}' },
      ],
    },
    everyone: {
      eyebrow: 'Und für alle anderen',
      title: 'Kein Profi nötig. Kein Technikfreak auch nicht.',
      sub: 'Wer ein Foto machen kann, kann Tiroir nutzen.',
      points: [
        { title: 'Keine Vorkenntnisse nötig', text: 'Keine Tabellen, keine leeren Formulare. Sie fotografieren, Tiroir füllt aus.' },
        { title: 'Ihre Daten gehören Ihnen', text: 'Keine Werbung, kein Weiterverkauf, kein Training von Modellen. Wer sein Konto löscht, löscht alles – sofort.' },
        { title: 'Teilen nur zum Ansehen', text: 'Ein Link zu einer Sammlung: Andere sehen sie ohne Konto und ohne App. Sie deaktivieren den Link, wann Sie wollen.' },
      ],
      usesTitle: 'Auch praktisch, um…',
      uses: ['Unterlagen für die Hausratversicherung vorzubereiten', 'Umzuziehen, ohne etwas zu verlieren', 'Preise für den Flohmarkt festzulegen', 'Den Kleiderschrank auszumisten'],
      why: 'Warum das funktioniert: Eine KI zur Bilderkennung beschreibt jedes Foto. Das Ergebnis bleibt ein Vorschlag – jedes Feld lässt sich ändern, und Ihre Korrekturen haben immer Vorrang.',
    },
    value: {
      eyebrow: 'Der Wert Ihrer Sachen',
      title: 'Wissen, was es wert ist – und dranbleiben.',
      sub: 'Eine Schätzung auf Basis vergleichbarer Angebote, keine Zahl aus dem Hut.',
      items: [
        { title: 'Schätzen', text: 'Eine Preisspanne – und die Angebote, aus denen sie stammt.' },
        { title: 'Verfolgen', text: 'Der Wert jedes Gegenstands und jeder Sammlung, aktualisiert, wann Sie wollen.' },
        { title: 'Verkaufen', text: 'Als „Verkauft“ markieren, mit dem echten Preis: Der Gegenstand bleibt in Ihrem Verlauf.' },
      ],
      note: 'Kein Gutachten: Bei seltenen Stücken ist es eine Größenordnung.',
      demo: { comparable: 'Vergleichbares Angebot', sold: 'Verkauft', trend: 'Wert der Sammlung' },
    },
    pricing: {
      eyebrow: 'Preise',
      title: 'Kostenlos starten.',
      sub: 'Wechseln Sie in einen höheren Tarif, wenn Sie ihn brauchen.',
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
        { q: 'Muss ich mich mit Technik auskennen?', a: 'Nein. Sie machen ein Foto, Tiroir füllt den Eintrag aus. Alles lässt sich mit einem Tippen ändern.' },
        { q: 'Und wenn der Eintrag falsch ist?', a: 'Jedes Feld ist bearbeitbar, und Ihre Korrekturen haben immer Vorrang. Die genaue Marke oder den Kaufpreis kennen nur Sie.' },
        { q: 'Sind meine Fotos privat?', a: 'Ja. Nichts ist öffentlich, solange Sie keinen Link teilen – und den können Sie jederzeit deaktivieren.' },
        { q: 'Wie zuverlässig ist die Schätzung?', a: 'Sie basiert auf vergleichbaren Angeboten: ein verlässlicher Startpreis für gängige Dinge, eine Größenordnung für seltene Stücke.' },
      ],
    },
    final: {
      title: 'Ihr erster Gegenstand, erfasst mit einem Foto.',
      sub: 'Kostenlos, ohne Kreditkarte.',
    },
  },
}

export default de
