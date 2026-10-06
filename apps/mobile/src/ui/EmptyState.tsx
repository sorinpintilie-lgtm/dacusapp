import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, spacing } from '../theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { enterUp } from './motion';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Animated.View entering={enterUp(0)} style={styles.badge}>
        <View style={styles.badgeInner}>
          <Ionicons name={icon} size={30} color={colors.textPrimary} />
        </View>
      </Animated.View>
      <Animated.View entering={enterUp(1)} style={styles.texts}>
        <AppText variant="title2" align="center">
          {title}
        </AppText>
        {message ? (
          <AppText variant="body" tone="secondary" align="center" style={styles.message}>
            {message}
          </AppText>
        ) : null}
      </Animated.View>
      {(actionLabel && onAction) || (secondaryLabel && onSecondary) ? (
        <Animated.View entering={enterUp(2)} style={styles.actions}>
          {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} size="lg" fullWidth /> : null}
          {secondaryLabel && onSecondary ? (
            <Button title={secondaryLabel} onPress={onSecondary} variant="ghost" fullWidth />
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.md },
  // Two rings: a soft brand halo around a neutral disc.
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { alignItems: 'center', gap: spacing.xs },
  message: { maxWidth: 320 },
  actions: { alignSelf: 'stretch', maxWidth: 360, width: '100%', gap: spacing.xxs, marginTop: spacing.xs },
});
