import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRef } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { AccountStackParamList } from '../navigation/types';
import { useApp } from '../state/AppProvider';
import { colors, continuous, fonts, radii, spacing } from '../theme/tokens';
import { AppText, Button, enterUp, ListItem, ListSection, Touchable } from '../ui';
import { RoofMark } from '../ui/RoofMark';

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter((letter): letter is string => !!letter)
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function AccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const rootNavigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const {
    accountUser,
    loyalty,
    loyaltyQrToken,
    orders,
    pendingOrdersCount,
    wishlist,
    addresses,
    unreadInboxCount,
    deviceSessions,
    preferenceOnboarding,
    logout,
    authBusy,
  } = useApp();

  if (!accountUser) {
    return (
      <ScrollView ref={scrollRef} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Animated.View entering={enterUp(0)} style={styles.hero}>
          <View style={styles.heroMark} pointerEvents="none">
            <RoofMark width={150} color={colors.brand} strokeWidth={8} />
          </View>
          <AppText variant="title1" tone="inverse" style={styles.heroTitle}>
            Bine ai venit la Dacus
          </AppText>
          <AppText variant="body" tone="inverseMuted" style={styles.heroTitle}>
            Intră în cont ca să urmărești comenzile, să aduni puncte și să plătești mai repede.
          </AppText>
          <View style={styles.heroActions}>
            <Button title="Intră în cont" size="lg" fullWidth onPress={() => rootNavigation.navigate('Login')} />
            <Button title="Creează cont nou" variant="onDark" fullWidth onPress={() => rootNavigation.navigate('Register')} />
          </View>
        </Animated.View>

        <Animated.View entering={enterUp(1)}>
          <ListSection title="Aplicație">
            <ListItem
              icon="heart-outline"
              title="Favorite"
              value={wishlist.size > 0 ? String(wishlist.size) : undefined}
              onPress={() => navigation.navigate('Wishlist')}
            />
            <ListItem icon="settings-outline" title="Setări" onPress={() => navigation.navigate('Settings')} />
          </ListSection>
        </Animated.View>
      </ScrollView>
    );
  }

  const name = accountUser.name || 'Client Dacus';
  const checklist = [
    { id: 'prefs', label: 'Preferințe de cumpărături', done: preferenceOnboarding.completed },
    { id: 'address', label: 'Adresă de livrare salvată', done: addresses.length > 0 },
    { id: 'qr', label: 'Card de membru activ', done: Boolean(loyaltyQrToken) },
    { id: 'order', label: 'Prima comandă', done: orders.length > 0 },
  ];
  const pendingSteps = checklist.filter((item) => !item.done).length;

  const confirmLogout = () =>
    Alert.alert('Te deconectezi?', 'Coșul și datele contului nu vor mai fi afișate pe acest dispozitiv.', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Deconectare', style: 'destructive', onPress: () => void logout() },
    ]);

  return (
    <ScrollView ref={scrollRef} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Animated.View entering={enterUp(0)} style={styles.hero}>
        <View style={styles.heroMark} pointerEvents="none">
          <RoofMark width={150} color={colors.brand} strokeWidth={8} />
        </View>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <AppText variant="title2" tone="inverse">
              {initialsOf(name) || 'D'}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="title2" tone="inverse" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="subhead" tone="inverseMuted" numberOfLines={1}>
              {accountUser.email}
            </AppText>
          </View>
        </View>
        <View style={styles.stats}>
          <Stat
            value={loyalty.points.toLocaleString('ro-RO')}
            label="Puncte"
            onPress={() => rootNavigation.navigate('MainTabs', { screen: 'LoyaltyTab' })}
          />
          <View style={styles.statDivider} />
          <Stat value={String(orders.length)} label="Comenzi" onPress={() => navigation.navigate('Orders')} />
          <View style={styles.statDivider} />
          <Stat value={String(wishlist.size)} label="Favorite" onPress={() => navigation.navigate('Wishlist')} />
        </View>
      </Animated.View>

      {loyaltyQrToken ? (
        <Animated.View entering={enterUp(1)}>
          <ListSection>
            <ListItem
              icon="qr-code-outline"
              title="Card de membru"
              subtitle={`Nivel ${loyalty.tier}. Arată codul la casă ca să primești puncte.`}
              onPress={() => rootNavigation.navigate('QrCode', { token: loyaltyQrToken, title: 'Card de membru', subtitle: name })}
            />
          </ListSection>
        </Animated.View>
      ) : null}

      <Animated.View entering={enterUp(2)}>
        <ListSection title="Cumpărături">
          <ListItem icon="receipt-outline" title="Comenzile mele" badge={pendingOrdersCount} onPress={() => navigation.navigate('Orders')} />
          <ListItem
            icon="heart-outline"
            title="Favorite"
            value={wishlist.size > 0 ? String(wishlist.size) : undefined}
            onPress={() => navigation.navigate('Wishlist')}
          />
          <ListItem
            icon="location-outline"
            title="Adrese de livrare"
            value={addresses.length > 0 ? String(addresses.length) : undefined}
            onPress={() => navigation.navigate('Addresses')}
          />
          <ListItem icon="notifications-outline" title="Notificări" badge={unreadInboxCount} onPress={() => navigation.navigate('Inbox')} />
        </ListSection>
      </Animated.View>

      <Animated.View entering={enterUp(3)}>
        <ListSection title="Cont">
          <ListItem
            icon="gift-outline"
            title="Program de fidelitate"
            onPress={() => rootNavigation.navigate('MainTabs', { screen: 'LoyaltyTab' })}
          />
          <ListItem icon="settings-outline" title="Setări" onPress={() => navigation.navigate('Settings')} />
          <ListItem
            icon="shield-checkmark-outline"
            title="Securitate și sesiuni"
            value={deviceSessions.length > 0 ? `${deviceSessions.length} dispozitive` : undefined}
            onPress={() => rootNavigation.navigate('DeviceSessions')}
          />
        </ListSection>
      </Animated.View>

      {pendingSteps > 0 ? (
        <ListSection title="Primii pași" footer={`${checklist.length - pendingSteps} din ${checklist.length} finalizați`}>
          {checklist.map((step) => (
            <ListItem
              key={step.id}
              title={step.label}
              right={
                <Ionicons
                  name={step.done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={step.done ? colors.success : colors.lineStrong}
                />
              }
            />
          ))}
        </ListSection>
      ) : null}

      <ListSection>
        <ListItem icon="log-out-outline" title="Deconectare" destructive disabled={authBusy} onPress={confirmLogout} />
      </ListSection>
    </ScrollView>
  );
}

function Stat({ value, label, onPress }: { value: string; label: string; onPress: () => void }) {
  return (
    <Touchable onPress={onPress} pressedScale={0.94} style={styles.stat} accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="title2" tone="inverse" style={styles.statValue}>
        {value}
      </AppText>
      <AppText variant="caption" tone="inverseMuted">
        {label}
      </AppText>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.xl, paddingBottom: spacing.xxxl },
  flex: { flex: 1 },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    ...continuous,
    overflow: 'hidden',
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroMark: { position: 'absolute', top: -22, right: -40 },
  // Text stays left of the roof line in the corner.
  heroTitle: { paddingRight: 92 },
  heroActions: { gap: spacing.xs, marginTop: spacing.xxs },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingRight: 92 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radii.md,
    ...continuous,
    paddingVertical: spacing.xs,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.xxs, gap: 1 },
  statValue: { fontFamily: fonts.bold, fontVariant: ['tabular-nums'] },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.18)' },
});
