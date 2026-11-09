import React, { forwardRef, useState } from 'react'
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native'
import { Colors, Typography, Spacing, Radius } from './tokens'
import { focusNextField } from './keyboard/FormScreen'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  containerStyle?: ViewStyle
}

/**
 * Champ de saisie. « Suivant » (`returnKeyType="next"`, le défaut) passe au
 * champ suivant sans fermer le clavier ; sur le dernier champ, passer
 * `returnKeyType="done"` (ou `go`, `send`…) et `onSubmitEditing` pour valider.
 * À poser dans un `FormScreen`, `FormScrollView` ou `FormSheet`.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, containerStyle, style, returnKeyType = 'next', onSubmitEditing, onFocus, onBlur, multiline, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false)
  const goesNext = returnKeyType === 'next' && !onSubmitEditing && !multiline

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor={Colors.textTertiary}
        returnKeyType={returnKeyType}
        submitBehavior={goesNext ? 'submit' : undefined}
        onSubmitEditing={goesNext ? () => focusNextField() : onSubmitEditing}
        multiline={multiline}
        onFocus={e => { setFocused(true); onFocus?.(e) }}
        onBlur={e => { setFocused(false); onBlur?.(e) }}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
  },
  input: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  inputFocused: {
    borderColor: Colors.accent,
  },
  inputError: {
    borderColor: Colors.error,
  },
  error: {
    fontSize: Typography.sm,
    color: Colors.error,
  },
})
