import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Colors, Typography, Spacing } from './tokens'
import { Button } from './Button'

interface EmptyStateProps {
  title: string
  subtitle?: string
  action?: { label: string; onPress: () => void }
  style?: ViewStyle
}

export function EmptyState({ title, subtitle, action, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
          fullWidth={false}
          style={styles.button}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.base * Typography.relaxed,
  },
  button: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
})
