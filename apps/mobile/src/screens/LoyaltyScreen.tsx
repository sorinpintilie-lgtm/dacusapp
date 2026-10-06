import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';

import QRCodeMatrix from '../components/QRCodeMatrix';
import type { LoyaltySummary } from '../services/commerce';
import { useApp } from '../state/AppProvider';
import { colors, continuous, fonts, radii, spacing } from '../theme/tokens';
import { AppText, Badge, Button, Card, Chip, enterUp, ListItem, ListSection, Touchable } from '../ui';
import { RoofMark } from '../ui/RoofMark';
import { formatPrice } from '../utils/catalogFilters';

type TierName = LoyaltySummary['tier'];

const TIERS: Array<{ name: TierName; min: number; max: number; benefit: string }> = [
  { name: 'Bronze', min: 0, max: 1499, benefit: 'Acumulare standard de puncte și acces la vouchere.' },
  { name: 'Silver', min: 1500, max: 4999, benefit: 'Prioritate la campanii și oferte dedicate.' },
  { name: 'Gold', min: 5000, max: Number.POSITIVE_INFINITY, benefit: 'Beneficii premium și suport preferențial.' },
];

const REDEEM_OPTIONS = [100, 300, 500, 1000];

const voucherValueFor = (points: number) => Math.floor(points / 100) * 5;

export function LoyaltyScreen() {
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const {
    accountUser,
    loyalty,
    tierProgress,
    voucherValueRon,
    loyaltyBusy,
    loyaltyRefreshing,
    loyaltyRedeemPoints,
    setLoyaltyRedeemPoints,
    loyaltyQrToken,
    loyaltyQrLoading,
    profileQrError,
    voucherQrToken,
    refreshLoyalty,
    retryLoyaltyQr,
    redeemVoucher,
    shareVoucher,
    shareLoyaltyCode,
  } = useApp();

  if (!accountUser) {
    return (
      <ScrollView ref={scrollRef} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Animated.View entering={enterUp(0)} style={styles.card}>
          <View style={styles.cardMark} pointerEvents="none">
            <RoofMark width={150} color={colors.brand} strokeWidth={8} />
          </View>
          <AppText variant="label" tone="inverseMuted">
            PROGRAM DE FIDELITATE
          </AppText>
          <AppText variant="title1" tone="inverse" style={styles.cardTitle}>
            Puncte la fiecare comandă
          </AppText>
          <AppText variant="body" tone="inverseMuted" style={styles.cardTitle}>
            1 RON cheltuit înseamnă 1 punct. 100 de puncte devin un voucher de 5 RON, online sau în magazin.
          </AppText>
          <View style={styles.cardActions}>
            <Button title="Intră în cont" size="lg" fullWidth onPress={() => navigation.navigate('Login')} />
            <Button title="Creează cont gratuit" variant="onDark" fullWidth onPress={() => navigation.navigate('Register')} />
          </View>
        </Animated.View>
        <Animated.View entering={enterUp(1)}>
          <TierList current={undefined} />
        </Animated.View>
      </ScrollView>
    );
  }

  const progressPercent = Math.min(100, Math.round(tierProgress * 100));
  const canRedeem = loyalty.points >= loyaltyRedeemPoints;
  const wallet = loyalty.voucherWallet;
  const activeVouchers = wallet?.active ?? [];
  const openQr = () =>
    loyaltyQrToken
      ? navigation.navigate('QrCode', { token: loyaltyQrToken, title: 'Card de membru', subtitle: accountUser.name })
      : undefined;

  return (
    <ScrollView
      ref={scrollRef}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loyaltyRefreshing} onRefresh={refreshLoyalty} tintColor={colors.brand} />}
    >
      <Animated.View entering={enterUp(0)} style={styles.card}>
        <View style={styles.cardMark} pointerEvents="none">
          <RoofMark width={150} color={colors.brand} strokeWidth={8} />
        </View>
        <View style={styles.cardTop}>
          <AppText variant="label" tone="inverseMuted">
            NIVEL {loyalty.tier.toUpperCase()}
          </AppText>
          {loyaltyRefreshing ? <ActivityIndicator color={colors.textInverse} /> : null}
        </View>
        <View>
          <AppText variant="display" tone="inverse" style={styles.points}>
            {loyalty.points.toLocaleString('ro-RO')}
          </AppText>
          <AppText variant="subhead" tone="inverseMuted">
            puncte, în valoare de {formatPrice(voucherValueRon)}
          </AppText>
        </View>
        <ProgressBar percent={progressPercent} />
        <AppText variant="footnote" tone="inverseMuted">
          {loyalty.tier === 'Gold'
            ? 'Ai atins nivelul maxim. Beneficiile premium sunt active.'
            : `Mai ai ${formatPrice(loyalty.nextTierSpendRon)} până la nivelul următor.`}
        </AppText>
      </Animated.View>

      <Animated.View entering={enterUp(1)}>
        <Card>
          <AppText variant="title3">Cardul de membru</AppText>
          {loyaltyQrToken ? (
            <View style={styles.qrRow}>
              <Touchable onPress={openQr} pressedScale={0.96} style={styles.qrThumb} accessibilityLabel="Mărește codul QR">
                <QRCodeMatrix value={loyaltyQrToken} size={104} />
              </Touchable>
              <View style={styles.qrActions}>
                <AppText variant="subhead" tone="secondary">
                  Arată codul la casă ca să primești puncte și în magazin.
                </AppText>
                <View style={styles.row}>
                  <Button title="Arată codul" icon="qr-code-outline" size="sm" variant="dark" onPress={openQr} />
                  <Button title="Distribuie" icon="share-outline" size="sm" variant="secondary" onPress={shareLoyaltyCode} />
                </View>
              </View>
            </View>
          ) : loyaltyQrLoading ? (
            <View style={styles.qrState}>
              <ActivityIndicator color={colors.brand} />
              <AppText variant="subhead" tone="secondary">
                Se generează codul...
              </AppText>
            </View>
          ) : (
            <View style={styles.qrState}>
              <AppText variant="subhead" tone="secondary" align="center">
                {profileQrError ?? 'Codul nu este disponibil momentan.'}
              </AppText>
              <Button title="Reîncearcă" size="sm" variant="secondary" onPress={retryLoyaltyQr} />
            </View>
          )}
        </Card>
      </Animated.View>

      <Animated.View entering={enterUp(2)}>
        <Card>
          <AppText variant="title3">Transformă punctele în voucher</AppText>
          <View style={styles.chips}>
            {REDEEM_OPTIONS.map((points) => (
              <Chip
                key={points}
                label={`${points} puncte = ${formatPrice(voucherValueFor(points))}`}
                selected={loyaltyRedeemPoints === points}
                disabled={loyalty.points < points}
                onPress={() => setLoyaltyRedeemPoints(points)}
              />
            ))}
          </View>
          <Button
            title={
              canRedeem
                ? `Generează voucher de ${formatPrice(voucherValueFor(loyaltyRedeemPoints))}`
                : `Îți lipsesc ${(loyaltyRedeemPoints - loyalty.points).toLocaleString('ro-RO')} puncte`
            }
            icon="ticket-outline"
            loading={loyaltyBusy}
            disabled={!canRedeem}
            onPress={redeemVoucher}
          />
        </Card>
      </Animated.View>

      {loyalty.lastVoucher && voucherQrToken ? (
        <Card>
          <View style={styles.voucherHead}>
            <AppText variant="title3">Ultimul voucher</AppText>
            <Badge label={formatPrice(loyalty.lastVoucher.valueRon)} tone="brandSoft" />
          </View>
          <AppText variant="subhead" tone="secondary" selectable>
            Cod {loyalty.lastVoucher.code}
            {loyalty.lastVoucher.expiresAt
              ? `, valabil până la ${new Date(loyalty.lastVoucher.expiresAt).toLocaleDateString('ro-RO')}`
              : ''}
          </AppText>
          <View style={styles.row}>
            <Button
              title="Arată la casă"
              icon="qr-code-outline"
              size="sm"
              variant="dark"
              onPress={() =>
                navigation.navigate('QrCode', {
                  token: voucherQrToken,
                  title: `Voucher ${formatPrice(loyalty.lastVoucher?.valueRon ?? 0)}`,
                  subtitle: loyalty.lastVoucher?.code,
                })
              }
            />
            <Button title="Distribuie" icon="share-outline" size="sm" variant="secondary" onPress={shareVoucher} />
          </View>
        </Card>
      ) : null}

      {wallet ? (
        <ListSection
          title="Vouchere active"
          footer={
            wallet.used.length > 0 || wallet.expired.length > 0
              ? `${wallet.used.length} folosite, ${wallet.expired.length} expirate`
              : undefined
          }
        >
          {activeVouchers.length === 0 ? (
            <ListItem icon="ticket-outline" title="Niciun voucher activ" subtitle="Generează unul din punctele tale." />
          ) : (
            activeVouchers.slice(0, 5).map((voucher) => (
              <ListItem
                key={voucher.code}
                icon="ticket-outline"
                title={formatPrice(voucher.valueRon)}
                subtitle={`${voucher.code}, valabil până la ${new Date(voucher.expiresAt).toLocaleDateString('ro-RO')}`}
              />
            ))
          )}
          {(wallet.expiringSoon?.length ?? 0) > 0 ? (
            <ListItem
              icon="time-outline"
              iconColor={colors.warning}
              title={`${wallet.expiringSoon?.length} ${wallet.expiringSoon?.length === 1 ? 'voucher expiră' : 'vouchere expiră'} în curând`}
            />
          ) : null}
        </ListSection>
      ) : null}

      <TierList current={loyalty.tier} />
    </ScrollView>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  // Fills from empty on first show, so the progress reads as progress.
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withDelay(250, withTiming(percent, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [fill, percent]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      accessibilityLabel="Progres spre nivelul următor"
    >
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

function TierList({ current }: { current: TierName | undefined }) {
  return (
    <ListSection title="Niveluri">
      {TIERS.map((tier) => (
        <ListItem
          key={tier.name}
          icon={tier.name === 'Gold' ? 'star-outline' : tier.name === 'Silver' ? 'medal-outline' : 'ribbon-outline'}
          title={tier.name === current ? `${tier.name}, nivelul tău` : tier.name}
          subtitle={`${
            tier.max === Number.POSITIVE_INFINITY
              ? `Peste ${tier.min.toLocaleString('ro-RO')} RON`
              : `${tier.min.toLocaleString('ro-RO')} - ${tier.max.toLocaleString('ro-RO')} RON`
          }. ${tier.benefit}`}
          accessory={tier.name === current ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : undefined}
        />
      ))}
    </ListSection>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.xl, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    ...continuous,
    overflow: 'hidden',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardMark: { position: 'absolute', top: -22, right: -40 },
  // Text stays left of the roof line in the corner.
  cardTitle: { paddingRight: 92 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardActions: { gap: spacing.xs, marginTop: spacing.xs },
  points: { fontSize: 44, lineHeight: 48, fontFamily: fonts.extrabold, fontVariant: ['tabular-nums'] },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.brand },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qrThumb: {
    padding: spacing.xs,
    borderRadius: radii.sm,
    ...continuous,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  qrActions: { flex: 1, gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  qrState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  voucherHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
