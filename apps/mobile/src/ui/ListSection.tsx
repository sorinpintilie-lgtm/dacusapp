import { Ionicons } from '@expo/vector-icons';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, continuous, radii, spacing } from '../theme/tokens';
import { AppText } from './AppText';
import { Touchable } from './Touchable';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type ListSectionProps = {
  title?: string;
  /** 'well' for sections placed on white screens. */
  tone?: 'surface' | 'well';
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Rows grouped on a white surface (used on grey, grouped screens). */
export function ListSection({ title, tone = 'surface', footer, children, style }: ListSectionProps) {
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={[styles.section, style]}>
      {title ? (
        <AppText variant="footnote" tone="secondary" style={styles.title}>
          {title}
        </AppText>
      ) : null}
      <View style={[styles.card, tone === 'well' && styles.cardWell]}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? <View style={styles.separator} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <AppText variant="footnote" tone="tertiary" style={styles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

type ListItemProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Icon colour; neutral by default so the brand red stays meaningful. */
  iconColor?: string;
  /** Text shown on the right, before the chevron. */
  value?: string;
  /** Interactive right-hand control (switch, button); kept outside the row's pressable area. */
  right?: ReactNode;
  /** Non-interactive right-hand element (checkmark, radio); replaces the chevron. */
  accessory?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  badge?: number;
  selected?: boolean;
};

export function ListItem({
  title,
  subtitle,
  icon,
  iconColor = colors.textPrimary,
  value,
  right,
  accessory,
  onPress,
  destructive = false,
  disabled = false,
  badge,
  selected,
}: ListItemProps) {
  const leading = (
    <>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={19} color={destructive ? colors.danger : iconColor} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <AppText variant="bodyMedium" tone={destructive ? 'danger' : 'primary'} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="subhead" tone="secondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </>
  );

  const trailing = right ?? (
    <View style={styles.trailing}>
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <AppText variant="label" tone="inverse">
            {badge > 99 ? '99+' : String(badge)}
          </AppText>
        </View>
      ) : null}
      {value ? (
        <AppText variant="subhead" tone="secondary" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {accessory ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} /> : null)}
    </View>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, disabled && styles.disabled]}>
        {leading}
        {trailing}
      </View>
    );
  }

  const a11y = {
    accessibilityLabel: subtitle ? `${title}, ${subtitle}` : title,
    accessibilityState: { disabled, selected },
  };

  // A custom right-hand control (often a button) stays outside the row's pressable area.
  if (right) {
    return (
      <View style={styles.row}>
        <Touchable onPress={onPress} disabled={disabled} pressedScale={0.985} haptic="selection" style={styles.rowMain} {...a11y}>
          {leading}
        </Touchable>
        {right}
      </View>
    );
  }

  return (
    <Touchable onPress={onPress} disabled={disabled} pressedScale={0.985} haptic="selection" style={styles.row} {...a11y}>
      {leading}
      {trailing}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  title: { paddingHorizontal: spacing.xxs },
  card: { backgroundColor: colors.surface, borderRadius: radii.md, ...continuous, overflow: 'hidden' },
  cardWell: { backgroundColor: colors.well },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: spacing.md },
  footer: { paddingHorizontal: spacing.xxs },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    ...continuous,
    backgroundColor: colors.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 1 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '45%' },
  value: { flexShrink: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
});
