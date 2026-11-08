// Marque de Torix, l'IA de Tiroir : le ✦ orange suivi d'un libellé
// (« Estimation Torix », « Résumé Torix »…). Un seul composant pour que
// chaque mention de Torix ait la même allure dans toute l'app.
//
// Règle de nommage (V4_PLAN.md, chantier 2) : Torix est celui qui agit
// (« Torix analyse ta photo… ») ; « IA » reste l'unité de compte des
// quotas et des crédits (« crédits IA », « 20 actions IA par mois »).
import React from 'react'
import { View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { Sparkles } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Colors, Typography } from './tokens'

interface TorixMarkProps {
  /** Libellé affiché après le ✦ ; « Torix » par défaut. */
  label?: string
  size?: number
  textStyle?: StyleProp<TextStyle>
  style?: StyleProp<ViewStyle>
}

export function TorixMark({ label, size = 14, textStyle, style }: TorixMarkProps) {
  const { t } = useTranslation()
  return (
    <View style={[styles.row, style]} accessibilityRole="text">
      <Sparkles size={size} color={Colors.accent} strokeWidth={2} />
      <Text style={[styles.label, textStyle]}>{label ?? t('torix.name')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.accent },
})
