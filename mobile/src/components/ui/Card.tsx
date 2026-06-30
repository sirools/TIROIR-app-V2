import React from 'react'
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native'
import { Colors, Radius, Spacing } from './tokens'

interface CardProps {
  children: React.ReactNode
  onPress?: () => void
  style?: ViewStyle
  padded?: boolean
}

export function Card({ children, onPress, style, padded = true }: CardProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.card, padded && styles.padded, style]}
      >
        {children}
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  padded: {
    padding: Spacing.md,
  },
})
