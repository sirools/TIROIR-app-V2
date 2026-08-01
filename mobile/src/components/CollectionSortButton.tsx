import React, { useState } from 'react'
import { Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react-native'
import { ActionSheet, Colors, Typography, Spacing } from '@/components/ui'
import { CollectionSort, COLLECTION_SORTS, sortLabelKey } from '@/features/collections/sort'

interface CollectionSortButtonProps {
  sort: CollectionSort
  onChange: (sort: CollectionSort) => void
}

/**
 * Action tertiaire : le tri est une commodité, pas une étape du parcours.
 * Le bouton porte le libellé du tri courant plutôt qu'une icône seule —
 * sinon rien n'indique dans quel ordre on lit la liste.
 */
export function CollectionSortButton({ sort, onChange }: CollectionSortButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <TouchableOpacity
        style={s.button}
        onPress={() => setOpen(true)}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={s.label}>{t(sortLabelKey(sort))}</Text>
        <ChevronDown size={13} color={Colors.textTertiary} strokeWidth={2} />
      </TouchableOpacity>

      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        options={[
          ...COLLECTION_SORTS.map(key => ({
            label: t(sortLabelKey(key)),
            selected: key === sort,
            onPress: () => onChange(key),
          })),
          { label: t('common.cancel'), cancel: true, onPress: () => {} },
        ]}
      />
    </>
  )
}

const s = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    fontWeight: Typography.medium,
  },
})
