import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import QRCodeMatrix from '../components/QRCodeMatrix';
import type { RootStackParamList } from '../navigation/types';
import { colors, radii, shadows, spacing } from '../theme/tokens';
import { AppText, Button } from '../ui';

export function QrCodeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'QrCode'>>();
  const { width } = useWindowDimensions();
  const { token, title, subtitle } = route.params;
  const size = Math.min(width - spacing.xl * 2 - spacing.lg * 2, 300);

  return (
    <View style={styles.screen}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => navigation.goBack()} accessibilityLabel="Închide" />
      <View style={styles.card}>
        <AppText variant="title2" align="center">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="subhead" tone="secondary" align="center">
            {subtitle}
          </AppText>
        ) : null}
        <View style={styles.code}>
          <QRCodeMatrix value={token} size={size} />
        </View>
        <AppText variant="subhead" tone="secondary" align="center">
          Arată codul la casă pentru scanare.
        </AppText>
        <Button title="Gata" size="lg" fullWidth onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.raised,
  },
  code: { padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, marginVertical: spacing.xs },
});
