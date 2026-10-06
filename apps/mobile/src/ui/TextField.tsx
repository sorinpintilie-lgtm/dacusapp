import { Ionicons } from '@expo/vector-icons';
import { useState, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { colors, continuous, fonts, hitSlop, radii, spacing } from '../theme/tokens';
import { AppText } from './AppText';
import { Touchable } from './Touchable';

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | null;
  hint?: string;
  /** Adds a show/hide toggle and hides the text by default. */
  password?: boolean;
  inputRef?: Ref<TextInput>;
  style?: StyleProp<ViewStyle>;
};

export function TextField({ label, error, hint, password = false, inputRef, style, ...inputProps }: TextFieldProps) {
  const [hidden, setHidden] = useState(password);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, style]}>
      <AppText variant="footnote" tone="secondary">
        {label}
      </AppText>
      <View style={[styles.inputRow, focused && styles.inputRowFocused, !!error && styles.inputRowError]}>
        <TextInput
          ref={inputRef}
          {...inputProps}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.brand}
          cursorColor={colors.brand}
          style={styles.input}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
        />
        {password ? (
          <Touchable
            onPress={() => setHidden((current) => !current)}
            hitSlop={hitSlop}
            pressedScale={0.85}
            accessibilityLabel={hidden ? 'Arată parola' : 'Ascunde parola'}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSecondary} />
          </Touchable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.message}>
          <Ionicons name="alert-circle" size={15} color={colors.danger} />
          <AppText variant="footnote" tone="danger" style={styles.messageText}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="footnote" tone="tertiary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  inputRow: {
    height: 52,
    borderRadius: radii.md,
    ...continuous,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inputRowFocused: { borderColor: colors.ink },
  inputRowError: { borderColor: colors.danger },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 0,
    // The browser focus ring is redundant with the field's own focus styling (web preview only).
    ...Platform.select({ web: { outlineWidth: 0 }, default: {} }),
  },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  messageText: { flex: 1 },
});
