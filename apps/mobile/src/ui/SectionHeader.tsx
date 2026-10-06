import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, hitSlop, spacing } from '../theme/tokens';
import { AppText } from './AppText';
import { Touchable } from './Touchable';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Small element before the title (e.g. a badge). */
  accessory?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, subtitle, actionLabel = 'Vezi tot', onAction, accessory, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <AppText variant="title2" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
          {accessory}
        </View>
        {subtitle ? (
          <AppText variant="subhead" tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {onAction ? (
        <Touchable
          onPress={onAction}
          hitSlop={hitSlop}
          pressedScale={0.94}
          style={styles.action}
          accessibilityLabel={`${actionLabel}: ${title}`}
        >
          <AppText variant="footnote" style={styles.actionLabel}>
            {actionLabel}
          </AppText>
          <Ionicons name="arrow-forward" size={15} color={colors.textPrimary} />
        </Touchable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  texts: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { flexShrink: 1 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  actionLabel: { color: colors.textPrimary },
});
