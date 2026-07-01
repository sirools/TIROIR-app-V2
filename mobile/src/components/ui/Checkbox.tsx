import React from 'react'
import { TouchableOpacity, View, StyleSheet } from 'react-native'
import { Check } from 'lucide-react-native'
import { Colors, Radius } from './tokens'

interface CheckboxProps {
  checked: boolean
  onToggle: () => void
}

export function Checkbox({ checked, onToggle }: CheckboxProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      hitSlop={10}
      activeOpacity={0.7}
      style={[styles.box, checked && styles.boxChecked]}
    >
      {checked && <Check size={13} color="white" strokeWidth={3} />}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  box: {
    width: 22, height: 22, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
})
