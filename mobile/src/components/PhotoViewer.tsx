import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useTranslation } from 'react-i18next'
import { Typography } from '@/components/ui'

/** Zoom maximum : au-delà, une photo de téléphone ne montre plus de détail. */
const MAX_SCALE = 5
const DOUBLE_TAP_SCALE = 3
const SPRING = { damping: 26, stiffness: 240, mass: 0.8 }
// Fond sombre : les commandes restent lisibles sur une zone claire de la photo zoomée.
const CONTROL_BG = 'rgba(0,0,0,0.5)'

type PanMode = 'none' | 'pan' | 'page' | 'dismiss'

export interface PhotoViewerItem {
  id: string
  url?: string
}

function Slide({
  item,
  index,
  width,
  height,
  activeIndex,
  scale,
  tx,
  ty,
  onSize,
}: {
  item: PhotoViewerItem
  index: number
  width: number
  height: number
  activeIndex: SharedValue<number>
  scale: SharedValue<number>
  tx: SharedValue<number>
  ty: SharedValue<number>
  onSize: (id: string, w: number, h: number) => void
}) {
  const style = useAnimatedStyle(() =>
    activeIndex.value === index
      ? { transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }
      : { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
  )

  return (
    <View style={[s.slide, { left: index * width, width, height }]}>
      <ActivityIndicator color="white" style={StyleSheet.absoluteFill} />
      {item.url && (
        <Animated.View style={[StyleSheet.absoluteFill, style]}>
          {/* allowDownscaling coupé : sinon l'image est décodée à la taille de
              l'écran et le zoom agrandit des pixels au lieu de révéler la photo. */}
          <Image
            source={{ uri: item.url }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            allowDownscaling={false}
            transition={120}
            onLoad={e => onSize(item.id, e.source.width, e.source.height)}
          />
        </Animated.View>
      )}
    </View>
  )
}

/**
 * Photos d'un objet en plein écran : swipe entre photos (dézoomé seulement),
 * swipe vers le bas pour fermer. Pour les abonnés : pincer, double-tap, déplacer.
 */
export default function PhotoViewer({ items, startIndex, zoomEnabled, onClose }: {
  items: PhotoViewerItem[]
  startIndex: number
  /** Sans zoom (compte gratuit), il reste le swipe entre photos et vers le bas. */
  zoomEnabled: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { width, height } = useWindowDimensions()
  const [current, setCurrent] = useState(startIndex)
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({})

  const activeIndex = useSharedValue(startIndex)
  const pageX = useSharedValue(-startIndex * width)
  const dismissY = useSharedValue(0)
  const scale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  // Taille de la photo à l'écran avant zoom (hors bandes noires), pour borner le déplacement.
  const fitW = useSharedValue(width)
  const fitH = useSharedValue(height)

  const startScale = useSharedValue(1)
  const startTx = useSharedValue(0)
  const startTy = useSharedValue(0)
  const startFocalX = useSharedValue(0)
  const startFocalY = useSharedValue(0)
  const panMode = useSharedValue<PanMode>('none')

  const currentId = items[current]?.id
  const size = currentId ? sizes[currentId] : undefined
  useEffect(() => {
    const ratio = size ? Math.min(width / size.w, height / size.h) : 1
    fitW.value = size ? size.w * ratio : width
    fitH.value = size ? size.h * ratio : height
  }, [size, width, height, fitW, fitH])

  useEffect(() => {
    // Rotation : la page reste calée sur la photo courante.
    pageX.value = -activeIndex.value * width
  }, [width, pageX, activeIndex])

  const gesture = useMemo(() => {
    const maxX = (s: number) => {
      'worklet'
      return Math.max(0, (fitW.value * s - width) / 2)
    }
    const maxY = (s: number) => {
      'worklet'
      return Math.max(0, (fitH.value * s - height) / 2)
    }
    const clamp = (v: number, limit: number) => {
      'worklet'
      return Math.min(limit, Math.max(-limit, v))
    }
    const settle = (s: number, x: number, y: number) => {
      'worklet'
      scale.value = withSpring(s, SPRING)
      tx.value = withSpring(x, SPRING)
      ty.value = withSpring(y, SPRING)
    }

    const pinch = Gesture.Pinch()
      .onStart(e => {
        startScale.value = scale.value
        startTx.value = tx.value
        startTy.value = ty.value
        startFocalX.value = e.focalX - width / 2
        startFocalY.value = e.focalY - height / 2
      })
      .onUpdate(e => {
        const next = Math.min(MAX_SCALE * 1.25, Math.max(0.7, startScale.value * e.scale))
        const ratio = next / startScale.value
        // Le point sous les doigts reste sous les doigts, même s'ils se déplacent.
        tx.value = e.focalX - width / 2 - ratio * (startFocalX.value - startTx.value)
        ty.value = e.focalY - height / 2 - ratio * (startFocalY.value - startTy.value)
        scale.value = next
      })
      .onEnd(() => {
        const target = Math.min(MAX_SCALE, Math.max(1, scale.value))
        if (target <= 1.01) {
          settle(1, 0, 0)
          return
        }
        const ratio = target / scale.value
        settle(target, clamp(tx.value * ratio, maxX(target)), clamp(ty.value * ratio, maxY(target)))
      })

    const pan = Gesture.Pan()
      .maxPointers(1)
      .minDistance(6)
      .onStart(() => {
        startTx.value = tx.value
        startTy.value = ty.value
        panMode.value = 'none'
      })
      .onUpdate(e => {
        if (panMode.value === 'none') {
          if (scale.value > 1.01) panMode.value = 'pan'
          else if (Math.abs(e.translationX) > Math.abs(e.translationY)) panMode.value = 'page'
          else if (e.translationY > 0) panMode.value = 'dismiss'
          else return
        }
        if (panMode.value === 'pan') {
          const s = scale.value
          tx.value = clamp(startTx.value + e.translationX, maxX(s))
          ty.value = clamp(startTy.value + e.translationY, maxY(s))
        } else if (panMode.value === 'page') {
          const atEdge =
            (activeIndex.value === 0 && e.translationX > 0) ||
            (activeIndex.value === items.length - 1 && e.translationX < 0)
          pageX.value = -activeIndex.value * width + e.translationX * (atEdge ? 0.3 : 1)
        } else {
          dismissY.value = Math.max(0, e.translationY)
        }
      })
      .onEnd(e => {
        if (panMode.value === 'pan') {
          const s = scale.value
          tx.value = withDecay({ velocity: e.velocityX, clamp: [-maxX(s), maxX(s)] })
          ty.value = withDecay({ velocity: e.velocityY, clamp: [-maxY(s), maxY(s)] })
        } else if (panMode.value === 'page') {
          let next = activeIndex.value
          if (e.translationX < -width / 4 || e.velocityX < -500) next += 1
          else if (e.translationX > width / 4 || e.velocityX > 500) next -= 1
          next = Math.min(items.length - 1, Math.max(0, next))
          activeIndex.value = next
          pageX.value = withSpring(-next * width, SPRING)
          scheduleOnRN(setCurrent, next)
        } else if (panMode.value === 'dismiss') {
          if (e.translationY > 120 || e.velocityY > 800) {
            dismissY.value = withTiming(height, { duration: 180 }, finished => {
              if (finished) scheduleOnRN(onClose)
            })
          } else {
            dismissY.value = withSpring(0, SPRING)
          }
        }
        panMode.value = 'none'
      })

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(280)
      .onEnd(e => {
        if (scale.value > 1.01) {
          settle(1, 0, 0)
          return
        }
        const target = DOUBLE_TAP_SCALE
        const x = -(e.x - width / 2) * (target - 1)
        const y = -(e.y - height / 2) * (target - 1)
        settle(target, clamp(x, maxX(target)), clamp(y, maxY(target)))
      })

    return zoomEnabled ? Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan)) : pan
  }, [
    width, height, items.length, onClose, zoomEnabled,
    activeIndex, pageX, dismissY, scale, tx, ty, fitW, fitH,
    startScale, startTx, startTy, startFocalX, startFocalY, panMode,
  ])

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pageX.value }, { translateY: dismissY.value }],
  }))
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 0.95 * Math.max(0.2, 1 - dismissY.value / (height * 0.7)),
  }))

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={s.root}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]} />
        <GestureDetector gesture={gesture}>
          <View style={[StyleSheet.absoluteFill, s.stage]} collapsable={false}>
            <Animated.View style={[StyleSheet.absoluteFill, rowStyle]}>
              {items.map((item, i) =>
                // Seules la photo courante et ses voisines sont gardées en mémoire :
                // en pleine résolution, chacune pèse lourd une fois décodée.
                Math.abs(i - current) <= 1 ? (
                  <Slide
                    key={item.id}
                    item={item}
                    index={i}
                    width={width}
                    height={height}
                    activeIndex={activeIndex}
                    scale={scale}
                    tx={tx}
                    ty={ty}
                    onSize={(id, w, h) => setSizes(prev => (prev[id] ? prev : { ...prev, [id]: { w, h } }))}
                  />
                ) : null,
              )}
            </Animated.View>
          </View>
        </GestureDetector>
        {items.length > 1 && (
          <View style={s.dots} pointerEvents="none">
            {items.map((item, i) => (
              <View key={item.id} style={[s.dot, i === current && s.dotActive]} />
            ))}
          </View>
        )}
        {items.length > 1 && (
          <Text style={s.counter} pointerEvents="none">{current + 1} / {items.length}</Text>
        )}
        <TouchableOpacity
          style={s.closeBtn}
          onPress={onClose}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('object.photoViewerClose')}
        >
          <Text style={s.closeIcon}>✕</Text>
        </TouchableOpacity>
      </GestureHandlerRootView>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: 'black' },
  // La photo zoomée déborde : sa scène l'enferme, les commandes restent au-dessus.
  stage: { overflow: 'hidden', zIndex: 0 },
  slide: { position: 'absolute', top: 0, overflow: 'hidden' },
  dots: {
    position: 'absolute', bottom: 52, alignSelf: 'center', zIndex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, height: 22, borderRadius: 11,
    backgroundColor: CONTROL_BG,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: 'white', width: 20 },
  counter: {
    position: 'absolute', bottom: 52, right: 20, zIndex: 1,
    paddingHorizontal: 8, lineHeight: 22, borderRadius: 11, overflow: 'hidden',
    backgroundColor: CONTROL_BG,
    color: 'white', fontSize: Typography.sm,
  },
  closeBtn: {
    position: 'absolute', top: 54, right: 20, zIndex: 1,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CONTROL_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon: { color: 'white', fontSize: 16, fontWeight: '600' },
})
