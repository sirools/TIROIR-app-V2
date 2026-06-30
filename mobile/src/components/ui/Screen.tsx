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
}

export function Screen({
  children,
  scroll = false,
  style,
  contentStyle,
  edges = ['top', 'bottom'],
}: ScreenProps) {
  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
})
