import QRCodeMatrix from '../components/QRCodeMatrix';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Skeleton } from '../components/Skeleton';
import type { LoyaltySummary } from '../services/commerce';
import { formatPrice } from '../utils/catalogFilters';
import type { ScreenStyles } from './screenTypes';
import { colors, radii, spacing, typography } from '../theme/tokens';

type LoyaltyTierName = 'Bronze' | 'Silver' | 'Gold';

type LoyaltyTier = {
  name: LoyaltyTierName;
  min: number;
  max: number;
};

type LoyaltyScreenProps = {
  styles: ScreenStyles;
  isLoading: boolean;
  loyalty: LoyaltySummary;
  tierProgress: number;
  loyaltyRefreshing: boolean;
  loyaltyBusy: boolean;
  loyaltyRedeemPoints: number;
  voucherValueRon: number;
  loyaltyTiers: LoyaltyTier[];
  tierBenefitText: string;
  voucherQrToken: string | null;
  loyaltyQrToken: string | null;
  loyaltyQrLoading: boolean;
  loyaltyQrError: string | null;
  onRefreshLoyalty: () => void;
  onRetryLoyaltyQr: () => void;
  onSetRedeemPoints: (points: number) => void;
  onOpenVoucherQrPreview: () => void;
  onShareVoucher: () => void;
  onOpenLoyaltyQrPreview: () => void;
  onShareQrToken: () => void;
  onRedeemVoucher: () => void;
};

const TIER_COLORS: Record<LoyaltyTierName, { bg: string; text: string; border: string }> = {
  Bronze: { bg: '#FDF4EC', text: '#92400E', border: '#F5DFC0' },
  Silver: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  Gold:   { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
};

export const LoyaltyScreen = ({
  styles,
  isLoading,
  loyalty,
  tierProgress,
  loyaltyRefreshing,
  loyaltyBusy,
  loyaltyRedeemPoints,
  voucherValueRon,
  loyaltyTiers,
  tierBenefitText,
  voucherQrToken,
  loyaltyQrToken,
  loyaltyQrLoading,
  loyaltyQrError,
  onRefreshLoyalty,
  onRetryLoyaltyQr,
  onSetRedeemPoints,
  onOpenVoucherQrPreview,
  onShareVoucher,
  onOpenLoyaltyQrPreview,
  onShareQrToken,
  onRedeemVoucher,
}: LoyaltyScreenProps) => {
  if (isLoading) {
    return (
      <View style={styles.stackLarge}>
        <Skeleton height={180} />
        <Skeleton height={80} />
        <Skeleton height={120} />
        <Skeleton height={80} />
      </View>
    );
  }

  const tierColor = TIER_COLORS[loyalty.tier as LoyaltyTierName] ?? TIER_COLORS.Bronze;
  const progressPercent = Math.min(100, Math.round(tierProgress * 100));
  const hasActiveVouchers = (loyalty.voucherWallet?.active?.length ?? 0) > 0;
  const canRedeem = loyalty.points >= loyaltyRedeemPoints;

  return (
    <View style={styles.stackLarge}>

      {/* HERO */}
      <View style={[local.heroCard, { borderColor: tierColor.border, backgroundColor: tierColor.bg }]}>
        <View style={local.heroTop}>
          <View style={local.heroLeft}>
            <View style={[local.tierBadge, { backgroundColor: tierColor.border }]}>
              <Ionicons
                name={loyalty.tier === 'Gold' ? 'star' : loyalty.tier === 'Silver' ? 'shield-half' : 'shield-outline'}
                size={14}
                color={tierColor.text}
              />
              <Text style={[local.tierBadgeText, { color: tierColor.text }]}>{loyalty.tier}</Text>
            </View>
            <Text style={local.pointsValue}>{loyalty.points.toLocaleString('ro-RO')}</Text>
            <Text style={local.pointsLabel}>puncte disponibile</Text>
          </View>
          <TouchableOpacity style={local.refreshButton} onPress={onRefreshLoyalty} disabled={loyaltyRefreshing}>
            <Ionicons name={loyaltyRefreshing ? 'refresh' : 'refresh-outline'} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={local.progressSection}>
          <View style={local.progressTrack}>
            <View style={[local.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={[local.progressLabel, { color: tierColor.text }]}>
            {loyalty.tier === 'Gold'
              ? 'Nivel maxim atins — beneficii premium active'
              : `${loyalty.nextTierSpendRon} RON pana la nivelul urmator`}
          </Text>
        </View>

        <Text style={local.rateNote}>1 RON cheltuit = 1 punct · 100 puncte = voucher 5 RON</Text>
      </View>

      {/* STATS */}
      <View style={local.statsRow}>
        <View style={local.statCard}>
          <Ionicons name="wallet-outline" size={20} color={colors.brandGreen} />
          <Text style={local.statValue}>{formatPrice(voucherValueRon)}</Text>
          <Text style={local.statLabel}>{'valoare\ndisponibila'}</Text>
        </View>
        <View style={[local.statCard, local.statCardMiddle]}>
          <Ionicons name="ticket-outline" size={20} color={colors.brandAmber} />
          <Text style={local.statValue}>{hasActiveVouchers ? loyalty.voucherWallet!.active.length : 0}</Text>
          <Text style={local.statLabel}>{'vouchere\nactive'}</Text>
        </View>
        <View style={local.statCard}>
          <Ionicons name="star-outline" size={20} color={colors.brandBlue} />
          <Text style={local.statValue}>{loyalty.tier}</Text>
          <Text style={local.statLabel}>{'nivel\ncurent'}</Text>
        </View>
      </View>

      {/* GENERATE VOUCHER */}
      <View style={local.redeemCard}>
        <View style={local.redeemHeader}>
          <Ionicons name="cash-outline" size={18} color={colors.brandGreen} />
          <Text style={styles.sectionLabel}>Genereaza voucher</Text>
        </View>
        <Text style={styles.bodyMuted}>Alege valoarea dorita:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipRow}
        >
          {[100, 300, 500, 1000].map((pts) => {
            const active = loyaltyRedeemPoints === pts;
            const enough = loyalty.points >= pts;
            return (
              <TouchableOpacity
                key={pts}
                style={[local.redeemChip, active && local.redeemChipActive, !enough && local.redeemChipDisabled]}
                onPress={() => onSetRedeemPoints(pts)}
              >
                <Text style={[local.redeemChipText, active && local.redeemChipTextActive, !enough && local.redeemChipTextDisabled]}>
                  {pts} pct
                </Text>
                <Text style={[local.redeemChipSub, active && local.redeemChipTextActive, !enough && local.redeemChipTextDisabled]}>
                  = {formatPrice(Math.floor(pts / 100) * 5)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[local.redeemCta, (!canRedeem || loyaltyBusy) && local.redeemCtaDisabled]}
          onPress={onRedeemVoucher}
          disabled={loyaltyBusy || !canRedeem}
        >
          <Ionicons name="ticket-outline" size={16} color="#FFFFFF" />
          <Text style={local.redeemCtaText}>
            {loyaltyBusy
              ? 'Se proceseaza...'
              : canRedeem
              ? `Genereaza voucher de ${formatPrice(Math.floor(loyaltyRedeemPoints / 100) * 5)}`
              : `Iti lipsesc ${loyaltyRedeemPoints - loyalty.points} puncte`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* LOYALTY QR */}
      <View style={styles.cardPlain}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="qr-code-outline" size={18} color={colors.brandBlue} />
          <Text style={styles.sectionLabel}>Codul tau de fidelitate</Text>
        </View>
        <Text style={styles.bodyMuted}>Arata codul la casa pentru a acumula puncte in magazin.</Text>

        {loyaltyQrToken ? (
          <View style={local.qrSection}>
            <TouchableOpacity style={local.qrWrap} activeOpacity={0.9} onPress={onOpenLoyaltyQrPreview}>
              <QRCodeMatrix value={loyaltyQrToken} size={200} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, local.shareBtn]} onPress={onShareQrToken}>
              <Ionicons name="share-outline" size={16} color={colors.brandRed} />
              <Text style={styles.secondaryButtonText}>Partajeaza codul</Text>
            </TouchableOpacity>
          </View>
        ) : loyaltyQrLoading ? (
          <View style={local.qrPlaceholder}>
            <Skeleton height={200} width={200} />
            <Text style={styles.bodyMuted}>Se genereaza codul QR...</Text>
          </View>
        ) : (
          <View style={local.qrError}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.bodyMuted}>{loyaltyQrError ?? 'Codul QR nu este disponibil momentan.'}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={onRetryLoyaltyQr}>
              <Text style={styles.secondaryButtonText}>Reincearca</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* VOUCHER WALLET */}
      {loyalty.voucherWallet ? (
        <View style={styles.cardPlain}>
          <View style={styles.sectionHeadRow}>
            <Ionicons name="wallet-outline" size={18} color={colors.brandGreen} />
            <Text style={styles.sectionLabel}>Wallet vouchere</Text>
          </View>

          {loyalty.voucherWallet.active.length === 0 ? (
            <Text style={styles.bodyMuted}>Niciun voucher activ. Genereaza unul mai sus.</Text>
          ) : (
            loyalty.voucherWallet.active.slice(0, 5).map((item) => (
              <View key={item.code} style={local.voucherCard}>
                <View style={local.voucherCardLeft}>
                  <View style={local.voucherCodeRow}>
                    <Ionicons name="ticket" size={14} color={colors.brandGreen} />
                    <Text style={local.voucherCode}>{item.code}</Text>
                  </View>
                  <Text style={local.voucherValue}>{formatPrice(item.valueRon)}</Text>
                </View>
                <View style={local.voucherCardRight}>
                  <Text style={local.voucherExpiry}>
                    Exp. {new Date(item.expiresAt).toLocaleDateString('ro-RO')}
                  </Text>
                  <View style={[local.voucherStatusPill, local.voucherStatusActive]}>
                    <Text style={local.voucherStatusText}>Activ</Text>
                  </View>
                </View>
              </View>
            ))
          )}

          {(loyalty.voucherWallet.expiringSoon?.length ?? 0) > 0 ? (
            <View style={local.expiringSoonBanner}>
              <Ionicons name="time-outline" size={14} color={colors.warning} />
              <Text style={local.expiringSoonText}>
                {loyalty.voucherWallet.expiringSoon!.length} voucher(e) expira in curand!
              </Text>
            </View>
          ) : null}

          {loyalty.voucherWallet.used.length > 0 || loyalty.voucherWallet.expired.length > 0 ? (
            <Text style={[styles.bodyMuted, { marginTop: spacing.xs }]}>
              {loyalty.voucherWallet.used.length} utilizate · {loyalty.voucherWallet.expired.length} expirate
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* LAST VOUCHER QR */}
      {loyalty.lastVoucher && voucherQrToken ? (
        <View style={styles.cardPlain}>
          <View style={styles.sectionHeadRow}>
            <Ionicons name="ticket-outline" size={18} color={colors.brandAmber} />
            <Text style={styles.sectionLabel}>Prezinta voucher la casa</Text>
          </View>
          <Text style={styles.bodyText}>{loyalty.lastVoucher.code}</Text>
          <Text style={styles.bodyMuted}>{formatPrice(loyalty.lastVoucher.valueRon)}</Text>
          {loyalty.lastVoucher.expiresAt ? (
            <Text style={styles.bodyMuted}>
              Expira: {new Date(loyalty.lastVoucher.expiresAt).toLocaleDateString('ro-RO')}
            </Text>
          ) : null}
          <View style={local.qrSection}>
            <TouchableOpacity style={local.qrWrap} activeOpacity={0.9} onPress={onOpenVoucherQrPreview}>
              <QRCodeMatrix value={voucherQrToken} size={200} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, local.shareBtn]} onPress={onShareVoucher}>
              <Ionicons name="share-outline" size={16} color={colors.brandRed} />
              <Text style={styles.secondaryButtonText}>Partajeaza voucherul</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* TIERS */}
      <View style={styles.cardPlain}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="layers-outline" size={18} color={colors.brandBlue} />
          <Text style={styles.sectionLabel}>Niveluri de fidelitate</Text>
        </View>
        {loyaltyTiers.map((tier) => {
          const active = tier.name === loyalty.tier;
          const tc = TIER_COLORS[tier.name];
          return (
            <View
              key={tier.name}
              style={[local.tierRow, active && { backgroundColor: tc.bg, borderColor: tc.border, borderWidth: 1 }]}
            >
              <View style={local.tierRowLeft}>
                <Ionicons
                  name={tier.name === 'Gold' ? 'star' : tier.name === 'Silver' ? 'shield-half' : 'shield-outline'}
                  size={16}
                  color={active ? tc.text : colors.textSecondary}
                />
                <Text style={[local.tierName, active && { color: tc.text, fontWeight: '800' }]}>
                  {tier.name}
                </Text>
                {active ? <View style={local.activeDot} /> : null}
              </View>
              <Text style={local.tierRange}>
                {tier.max === Number.POSITIVE_INFINITY
                  ? `${tier.min.toLocaleString('ro-RO')}+ RON`
                  : `${tier.min.toLocaleString('ro-RO')} - ${tier.max.toLocaleString('ro-RO')} RON`}
              </Text>
            </View>
          );
        })}
      </View>

      {/* BENEFITS */}
      <View style={styles.cardPlain}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="gift-outline" size={18} color={colors.brandRed} />
          <Text style={styles.sectionLabel}>Beneficii {loyalty.tier}</Text>
        </View>
        <Text style={styles.bodyMuted}>{tierBenefitText}</Text>
      </View>
    </View>
  );
};

const local = StyleSheet.create({
  heroCard: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLeft: { gap: 4 },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.pill,
    marginBottom: spacing.xs,
  },
  tierBadgeText: { fontSize: typography.micro, fontWeight: '800' },
  pointsValue: { fontSize: 36, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1 },
  pointsLabel: { fontSize: typography.caption, color: colors.textSecondary, fontWeight: '600' },
  refreshButton: { padding: spacing.xs },
  progressSection: { gap: 6 },
  progressTrack: { height: 8, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: radii.pill, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brandRed, borderRadius: radii.pill },
  progressLabel: { fontSize: typography.caption, fontWeight: '600' },
  rateNote: { fontSize: typography.micro, color: colors.textSecondary },

  statsRow: { flexDirection: 'row', gap: spacing.xs },
  statCard: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.sm, alignItems: 'center', gap: 4 },
  statCardMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  statValue: { fontSize: typography.h3, fontWeight: '900', color: colors.textPrimary },
  statLabel: { fontSize: typography.micro, color: colors.textSecondary, textAlign: 'center' },

  redeemCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  redeemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  redeemChip: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginRight: spacing.xs,
    minWidth: 80,
  },
  redeemChipActive: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  redeemChipDisabled: { opacity: 0.45 },
  redeemChipText: { fontSize: typography.caption, fontWeight: '800', color: colors.textPrimary },
  redeemChipSub: { fontSize: typography.micro, color: colors.textSecondary, fontWeight: '600' },
  redeemChipTextActive: { color: '#16A34A' },
  redeemChipTextDisabled: { color: colors.textSecondary },
  redeemCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#16A34A',
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    minHeight: 50,
  },
  redeemCtaDisabled: { backgroundColor: colors.textSecondary, opacity: 0.55 },
  redeemCtaText: { color: '#FFFFFF', fontWeight: '800', fontSize: typography.body },

  qrSection: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  qrWrap: { padding: spacing.md, backgroundColor: '#FFFFFF', borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  qrPlaceholder: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  qrError: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  voucherCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: '#F0FDF4',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: spacing.xs,
  },
  voucherCardLeft: { gap: 2 },
  voucherCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voucherCode: { fontSize: typography.caption, fontWeight: '900', color: colors.textPrimary, letterSpacing: 0.5 },
  voucherValue: { fontSize: typography.h3, fontWeight: '900', color: colors.success },
  voucherCardRight: { alignItems: 'flex-end', gap: 4 },
  voucherExpiry: { fontSize: typography.micro, color: colors.textSecondary },
  voucherStatusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill },
  voucherStatusActive: { backgroundColor: '#DCFCE7' },
  voucherStatusText: { fontSize: typography.micro, fontWeight: '800', color: colors.success },

  expiringSoonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.semanticWarningBg,
    borderRadius: radii.sm,
    padding: spacing.xs,
    marginTop: spacing.xs,
  },
  expiringSoonText: { fontSize: typography.caption, color: colors.warning, fontWeight: '700' },

  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    marginBottom: 4,
  },
  tierRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tierName: { fontSize: typography.body, fontWeight: '700', color: colors.textPrimary },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandRed, marginLeft: 4 },
  tierRange: { fontSize: typography.caption, color: colors.textSecondary },
});
