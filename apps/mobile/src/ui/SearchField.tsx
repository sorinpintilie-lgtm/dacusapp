import { Ionicons } from '@expo/vector-icons';
import type { Ref } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, continuous, fonts, hitSlop, radii, spacing } from '../theme/tokens';
import { fadeIn, fadeOut } from './motion';
import { Touchable } from './Touchable';

type SearchFieldProps = Omit<TextInputProps, 'style'> & {
  inputRef?: Ref<TextInput>;
  onClear?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SearchField({ inputRef, value, onClear, style, ...rest }: SearchFieldProps) {
  return (
    <View style={[styles.field, style]}>
      <Ionicons name="search" size={19} color={colors.textSecondary} />
      <TextInput
        ref={inputRef}
        value={value}
        style={styles.input}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.brand}
        cursorColor={colors.brand}
        returnKeyType="search"
        enterKeyHint="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        {...rest}
      />
      {value && onClear ? (
        <Animated.View entering={fadeIn} exiting={fadeOut}>
          <Touchable onPress={onClear} hitSlop={hitSlop} pressedScale={0.85} accessibilityLabel="Șterge textul">
            <Ionicons name="close-circle" size={19} color={colors.textTertiary} />
          </Touchable>
        </Animated.View>
      ) : null}
    </View>
  );
}

type SearchTriggerProps = {
  placeholder: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Looks like a search field; opens the search screen. */
export function SearchTrigger({ placeholder, onPress, style }: SearchTriggerProps) {
  return (
    <Touchable
      onPress={onPress}
      pressedScale={0.98}
      accessibilityRole="search"
      accessibilityLabel={placeholder}
      style={[styles.field, style]}
    >
      <Ionicons name="search" size={19} color={colors.textSecondary} />
      <Text style={styles.placeholder} numberOfLines={1}>
        {placeholder}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 46,
    borderRadius: radii.md,
    ...continuous,
    backgroundColor: colors.well,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
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
  placeholder: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.textTertiary },
});
