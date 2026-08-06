import React from 'react'
import { View, StyleSheet, ScrollView, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from './tokens'

interface ScreenProps {
  children: React.ReactNode
  scroll?: boolean
  style?: ViewStyle
  contentStyle?: ViewStyle
  edges?: ('top' | 'bottom' | 'left' | 'right')[]
  /**
   * Couleur de la zone sûre haute — celle où l'OS affiche l'heure et le
   * réseau. Par défaut le fond de page ; à passer en `Colors.surface`
   * quand l'écran commence par un bandeau blanc, pour que la barre d'état
   * se pose dessus sans marche beige.
   */
  topColor?: string
}

export function Screen({
  children,
  scroll = false,
  style,
  contentStyle,
  edges = ['top', 'bottom'],
  topColor,
}: ScreenProps) {
  // La zone sûre prend `topColor`, le corps garde le fond de page : c'est
  // ce qui permet à la barre d'état d'être blanche sans repeindre l'écran.
  const body = (
    <View style={[styles.body, topColor ? { backgroundColor: Colors.background } : null]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentStyle]}>{children}</View>
      )}
    </View>
  )

  return (
    <SafeAreaView
      style={[styles.safe, topColor ? { backgroundColor: topColor } : null, style]}
      edges={edges}
    >
      {body}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  body: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
})
