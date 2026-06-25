export const statuses = [
  { label: 'En place', value: 'to_keep', color: '$statusGreen' },
  { label: 'À ranger', value: 'to_store', color: '$statusBlue' },
  { label: 'À vendre', value: 'for_sale', color: '$statusRed' },
  { label: 'À réparer', value: 'to_repare', color: '$statusYellow' },
  { label: 'Prêté', value: 'loaned', color: '$statusPurple' },
  { label: 'Perdu', value: 'lost', color: '$statusGray' },
]

export const getStatusMeta = (value: string) =>
  statuses.find((s) => s.value === value)