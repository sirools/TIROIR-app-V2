import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native'
import { Colors, Typography, Spacing, Radius } from './tokens'

export interface ActionSheetOption {
  label: string
  onPress: () => void
  destructive?: boolean
  cancel?: boolean
}

interface ActionSheetProps {
  visible: boolean
  options: ActionSheetOption[]
  onClose: () => void
}

export function ActionSheet({ visible, options, onClose }: ActionSheetProps) {
  const slideAnim = useRef(new Animated.Value(300)).current

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        mass: 0.9,
      }).start()
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [visible])

  const actions = options.filter(o => !o.cancel)
  const cancelOption = options.find(o => o.cancel)

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.actionsGroup}>
          {actions.map((opt, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.option}
                onPress={() => { onClose(); opt.onPress() }}
                activeOpacity={0.65}
              >
                <Text style={[styles.optionText, opt.destructive && styles.optionTextDestructive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {cancelOption && (
          <TouchableOpacity
            style={[styles.actionsGroup, styles.cancelGroup]}
            onPress={() => { onClose(); cancelOption.onPress?.() }}
            activeOpacity={0.65}
          >
            <Text style={styles.cancelText}>{cancelOption.label}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    paddingBottom: 36,
    gap: Spacing.sm,
  },
  actionsGroup: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  cancelGroup: {
    alignItems: 'center',
  },
  option: {
    paddingVertical: 17,
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.md,
  },
  optionText: {
    fontSize: Typography.md,
    color: Colors.textPrimary,
    fontWeight: Typography.regular,
  },
  optionTextDestructive: {
    color: Colors.error,
  },
  cancelText: {
    fontSize: Typography.md,
    color: Colors.textPrimary,
    fontWeight: Typography.semibold,
    paddingVertical: 17,
  },
})
