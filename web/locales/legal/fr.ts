// Généré par design/generate.mjs depuis design/i18n/site/fr.json — ne pas modifier à la main.
//
// Textes legal en français — référence de structure pour en, de, es
// (type LegalCopy). Importé par ../fr.ts sous la clé « legal ».
// Le corps des documents vit dans components/legal/{cgu,privacy}/.
const legalFr = {
  // Date de mise à jour, {date} formatée dans la langue (components/legal/date.ts).
  updated: 'Dernière mise à jour : {date}',
  // Avertissement en tête des traductions, suivi d'un lien vers la version
  // française. Vide en français : la page française n'en affiche pas.
  notice: '',
  noticeLink: '',
  cgu: {
    title: 'Conditions Générales d\'Utilisation — Tiroir',
    description: 'Conditions Générales d\'Utilisation de l\'application Tiroir.',
    heading: 'Conditions Générales d\'Utilisation',
  },
  privacy: {
    title: 'Politique de confidentialité — Tiroir',
    description: 'Politique de confidentialité de l\'application Tiroir.',
    heading: 'Politique de confidentialité',
  },
}

export type LegalCopy = typeof legalFr
export default legalFr
