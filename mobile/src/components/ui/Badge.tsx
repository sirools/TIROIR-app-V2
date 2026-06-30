import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Colors, Typography, Spacing, Radius } from './tokens'

interface BadgeProps {
  label: string
  style?: ViewStyle
}

export function Badge({ label, style }: BadgeProps) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs / 2,
    paddingHorizontal: Spacing.sm,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})
