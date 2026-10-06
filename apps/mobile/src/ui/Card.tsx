import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, continuous, radii, spacing } from '../theme/tokens';

type CardProps = {
  children: ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** White surface on grouped (grey) screens. No shadow: the grey canvas already separates it. */
export function Card({ children, padded = true, style }: CardProps) {
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.md, ...continuous },
  padded: { padding: spacing.md, gap: spacing.sm },
});
