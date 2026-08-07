import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { Colors, Typography, Spacing, Radius } from './tokens'

/**
 * Attente courte, à l'image du produit : trois tiroirs qui coulissent.
 *
 * Elle existe pour une raison précise — sans elle, l'accueil affichait
 * pendant une seconde « aucune collection » à quelqu'un qui en a dix. Un
 * état vide affiché à tort est pire qu'une attente : il annonce une perte.
 *
 * Animation par translation et opacité uniquement, donc `useNativeDriver` :
 * elle continue de tourner pendant que le fil JS charge les données.
 */
export function TiroirLoader({ label }: { label?: string }) {
  const bars = [useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current]

  useEffect(() => {
    const loops = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(v, {
            toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0, duration: 520, easing: Easing.in(Easing.cubic), useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 140),
        ]),
      ),
    )
    loops.forEach(l => l.start())
    return () => loops.forEach(l => l.stop())
  }, [])

  return (
    <View style={s.wrap}>
      <View style={s.cabinet}>
        {bars.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              s.drawer,
              {
                // Le tiroir sort par la droite, comme on l'ouvrirait.
                transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) }],
                opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
              },
            ]}
          />
        ))}
      </View>
      {label ? <Text style={s.label}>{label}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  cabinet: {
    width: 68, height: 60,
    justifyContent: 'space-between',
    padding: 7,
    borderRadius: Radius.md,
    borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  drawer: { height: 12, borderRadius: 3, backgroundColor: Colors.accent },
  label: { fontSize: Typography.sm, color: Colors.textTertiary },
})
