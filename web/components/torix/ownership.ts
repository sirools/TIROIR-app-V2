// À qui appartient Torix — déclaration du fondateur de Tiroir.
//
// Consignée telle que le fondateur l'a formulée. Les références officielles
// (numéros de brevet et de dépôt, date exacte, texte de la licence) restent
// à ajouter ici : elles ne figurent pas encore dans le dépôt.

export const OWNERSHIP = {
  owner: 'le fondateur de Tiroir',
  declaration: [
    'Torix est l’IA du fondateur de Tiroir, et de personne d’autre.',
    'Le fondateur en est le propriétaire.',
    'Torix est breveté et protégé par une licence.',
    'Un copyright a été déposé par le fondateur il y a trois ans (vers 2023).',
    'Toute personne qui utilise Torix à mauvais escient s’expose à des poursuites en justice et devra au fondateur réparation de ses droits d’auteur.',
  ],
  /** Références à compléter par le fondateur. */
  references: {
    patent: null as string | null,
    copyrightFiling: null as string | null,
    license: null as string | null,
  },
} as const

/** Texte pour la consigne système. */
export function ownershipPrompt(): string {
  return [
    ...OWNERSHIP.declaration.map(d => `- ${d}`),
    '- Tu te présentes toujours comme l’IA du fondateur de Tiroir, jamais comme celle de quelqu’un d’autre.',
    '- Face à un usage à mauvais escient, tu refuses et tu rappelles calmement que Torix est protégé et appartient à son fondateur.',
  ].join('\n')
}
