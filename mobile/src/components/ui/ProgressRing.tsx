import React, { useEffect } from 'react'
import { View, StyleSheet, type ViewStyle } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Colors, Motion } from './tokens'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const ease = Easing.bezier(...Motion.easing.out)

export interface ProgressRingProps {
  /** Fraction accomplie, de 0 à 1. Ignorée si `indeterminate`. */
  progress?: number
  /** Attente sans mesure : un arc qui tourne. */
  indeterminate?: boolean
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  style?: ViewStyle
  /** Contenu centré dans l'anneau (pourcentage, icône…). */
  children?: React.ReactNode
}

/**
 * Anneau de progression générique : envoi d'une photo aujourd'hui,
 * crédits ou quotas demain.
 *
 * Le tracé s'anime sur le fil d'interface (Reanimated) : chaque nouvelle
 * valeur glisse depuis la précédente, si bien qu'une progression qui
 * arrive par paquets se lit comme une avance continue.
 */
export function ProgressRing({
  progress = 0,
  indeterminate = false,
  size = 40,
  strokeWidth = 3,
  color = Colors.accent,
  trackColor = Colors.borderLight,
  style,
  children,
}: ProgressRingProps) {
  const reduceMotion = useReducedMotion()
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r

  const value = useSharedValue(indeterminate ? 0.25 : clamp(progress))
  const spin = useSharedValue(0)

  useEffect(() => {
    if (indeterminate) {
      value.value = 0.25
      return
    }
    value.value = reduceMotion
      ? clamp(progress)
      : withTiming(clamp(progress), { duration: Motion.duration.base, easing: ease })
  }, [progress, indeterminate, reduceMotion])

  useEffect(() => {
    if (indeterminate && !reduceMotion) {
      spin.value = 0
      spin.value = withRepeat(withTiming(1, { duration: Motion.duration.slow * 2, easing: Easing.linear }), -1, false)
    } else {
      cancelAnimation(spin)
      spin.value = 0
    }
    return () => cancelAnimation(spin)
  }, [indeterminate, reduceMotion])

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }))
  const rotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }))

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, rotation]}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={arcProps}
            // Départ à midi, sens horaire.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
      </Animated.View>
      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  )
}

function clamp(p: number) {
  return Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0))
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
})
