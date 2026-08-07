import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, Info } from 'lucide-react-native'
import { Colors, Typography, Spacing, Radius } from './tokens'

type ToastVariant = 'success' | 'error'

interface ToastPayload {
  /** Change à chaque appel : c'est lui qui relance l'animation d'entrée. */
  seq: number
  message: string
  variant: ToastVariant
  duration: number
}

interface ToastApi {
  showToast: (message: string, options?: { variant?: ToastVariant; duration?: number }) => void
}

const DEFAULT_DURATION = 3200

const ToastContext = createContext<ToastApi>({ showToast: () => {} })

/**
 * Message court et non bloquant, monté au-dessus des écrans.
 *
 * Il vit dans le layout et non dans l'écran qui le déclenche : c'est ce
 * qui lui permet de survivre à une navigation. On confirme une création
 * juste avant de remplacer l'écran, et le message accompagne l'arrivée
 * sur la fiche plutôt que de disparaître avec l'écran qu'on quitte.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const anim = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  const hide = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setToast(null)
    })
  }, [anim])

  const showToast = useCallback<ToastApi['showToast']>((message, options) => {
    seq.current += 1
    setToast({
      seq: seq.current,
      message,
      variant: options?.variant ?? 'success',
      duration: options?.duration ?? DEFAULT_DURATION,
    })
  }, [])

  useEffect(() => {
    if (!toast) return
    if (timer.current) clearTimeout(timer.current)

    anim.setValue(0)
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()

    timer.current = setTimeout(hide, toast.duration)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [toast?.seq])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const isError = toast?.variant === 'error'
  const Icon = isError ? Info : Check

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <View
          style={[styles.layer, { paddingTop: insets.top + Spacing.sm }]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.toast,
              isError && styles.toastError,
              {
                opacity: anim,
                transform: [
                  { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.inner}
              onPress={hide}
              activeOpacity={0.9}
              accessibilityRole="alert"
              accessibilityLabel={toast.message}
            >
              <View style={[styles.iconWrap, isError && styles.iconWrapError]}>
                <Icon size={13} color={Colors.textInverse} strokeWidth={3} />
              </View>
              <Text style={styles.message}>{toast.message}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  return useContext(ToastContext)
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  toast: {
    maxWidth: 420,
    width: '92%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    // Ombre douce : le message flotte sans écraser le contenu.
    shadowColor: '#1A1612',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  toastError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  inner: {
    flexDirection: 'row',
    // Ferré en haut : sur un message de trois lignes, une pastille centrée
    // se retrouve en face du milieu du texte au lieu de son début.
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  iconWrap: {
    width: 20,
    height: 20,
    // (lineHeight - hauteur de pastille) / 2 : la pastille tombe pile au
    // milieu de la première ligne.
    marginTop: 1,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapError: {
    backgroundColor: Colors.error,
  },
  message: {
    flex: 1,
    fontSize: Typography.base,
    lineHeight: 22,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
})
