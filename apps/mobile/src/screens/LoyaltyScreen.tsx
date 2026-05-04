import QRCodeMatrix from '../components/QRCodeMatrix';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Skeleton } from '../components/Skeleton';
import type { LoyaltySummary } from '../services/commerce';
import { formatPrice } from '../utils/catalogFilters';
import type { ScreenStyles } from './screenTypes';
import { colors, spacing } from '../theme/tokens';

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
        <Skeleton height={120} />
        <Skeleton height={70} />
        <Skeleton height={70} />
      </View>
    );
  }

  return (
    <View style={styles.stackLarge}>
      <View style={styles.loyaltyHero}>
        <View style={styles.loyaltyHeroTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Ionicons name="star-outline" size={22} color={colors.brandAmber} />
            <Text style={styles.loyaltyTitle}>Program de fidelitate</Text>
          </View>
          <Text style={styles.loyaltyTierTag}>{loyalty.tier}</Text>
        </View>

        <Text style={styles.loyaltyPoints}>{loyalty.points.toLocaleString('ro-RO')} puncte</Text>
        <Text style={styles.loyaltyMeta}>
          1 punct = 1 RON cheltuit • 100 puncte = 5 RON voucher
        </Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(tierProgress * 100)}%` }]} />
        </View>

        <Text style={styles.loyaltyMeta}>
          {loyalty.tier === 'Gold'
            ? 'Ai atins nivelul maxim. Beneficii premium active.'
            : `${loyalty.nextTierSpendRon} RON până la nivelul următor`}
        </Text>
      </View>

      <View style={styles.loyaltyActionRow}>
        <TouchableOpacity
          style={[
            styles.secondaryButton,
            { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
          ]}
          onPress={onRefreshLoyalty}
          disabled={loyaltyRefreshing || loyaltyBusy}
        >
          <Ionicons
            name={loyaltyRefreshing ? 'refresh' : 'refresh-outline'}
            size={16}
            color={colors.brandRed}
            style={loyaltyRefreshing ? { transform: [{ rotate: '180deg' }] } : {}}
          />
          <Text style={styles.secondaryButtonText}>
            {loyaltyRefreshing ? 'Se actualizează...' : 'Reîmprospătează'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardPlain}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="cash-outline" size={18} color={colors.brandGreen} />
          <Text style={styles.sectionLabel}>Valoare voucher dorită</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipRow}
        >
          {[100, 300, 500, 1000].map((pointsOption) => {
            const active = loyaltyRedeemPoints === pointsOption;
            return (
              <TouchableOpacity
                key={pointsOption}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => onSetRedeemPoints(pointsOption)}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {pointsOption} pct · {formatPrice(Math.floor(pointsOption / 100) * 5)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={styles.bodyMuted}>
          Ai nevoie de {loyaltyRedeemPoints} puncte pentru selecția curentă.
        </Text>
      </View>

      <View style={styles.loyaltyStatRow}>
        <View style={styles.loyaltyStatCard}>
          <Ionicons
            name="wallet-outline"
            size={20}
            color={colors.brandGreen}
            style={{ marginBottom: spacing.xxs }}
          />
          <Text style={styles.loyaltyStatLabel}>Valoare voucher disponibilă</Text>
          <Text style={styles.loyaltyStatValue}>{formatPrice(voucherValueRon)}</Text>
        </View>
        <View style={styles.loyaltyStatCard}>
          <Ionicons
            name="ticket-outline"
            size={20}
            color={colors.brandAmber}
            style={{ marginBottom: spacing.xxs }}
          />
          <Text style={styles.loyaltyStatLabel}>Puncte necesare / voucher</Text>
          <Text style={styles.loyaltyStatValue}>100</Text>
        </View>
      </View>

      <View style={styles.cardPlain}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="layers-outline" size={18} color={colors.brandBlue} />
          <Text style={styles.sectionLabel}>Niveluri</Text>
        </View>
        {loyaltyTiers.map((tier) => {
          const active = tier.name === loyalty.tier;
          return (
            <View key={tier.name} style={styles.tierRow}>
              <Text style={[styles.tierName, active && styles.tierNameActive]}>{tier.name}</Text>
              <Text style={styles.tierRange}>
                {tier.max === Number.POSITIVE_INFINITY
                  ? `${tier.min}+ RON`
                  : `${tier.min} - ${tier.max} RON`}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.cardPlain}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="star-outline" size={18} color={colors.brandAmber} />
          <Text style={styles.sectionLabel}>Beneficii nivel curent</Text>
        </View>
        <Text style={styles.bodyMuted}>{tierBenefitText}</Text>
      </View>

      {loyalty.voucherWallet ? (
        <View style={styles.cardPlain}>
          <View style={styles.sectionHeadRow}>
            <Ionicons name="wallet-outline" size={18} color={colors.brandGreen} />
            <Text style={styles.sectionLabel}>Wallet vouchere</Text>
          </View>
          <Text style={styles.bodyMuted}>Active: {loyalty.voucherWallet.active.length}</Text>
          <Text style={styles.bodyMuted}>
            Expiră curând: {loyalty.voucherWallet.expiringSoon.length}
          </Text>
          <Text style={styles.bodyMuted}>Utilizate: {loyalty.voucherWallet.used.length}</Text>
          <Text style={styles.bodyMuted}>Expirate: {loyalty.voucherWallet.expired.length}</Text>
          {loyalty.voucherWallet.active.slice(0, 3).map((item) => (
            <View key={item.code} style={styles.tierRow}>
              <Text style={styles.tierName}>{item.code}</Text>
              <Text style={styles.tierRange}>
                {formatPrice(item.valueRon)} •{' '}
                {new Date(item.expiresAt).toLocaleDateString('ro-RO')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

       {loyalty.lastVoucher ? (
         <View style={styles.cardPlain}>
           <View style={styles.sectionHeadRow}>
             <Ionicons name="ticket-outline" size={18} color={colors.brandAmber} />
             <Text style={styles.sectionLabel}>Ultimul voucher</Text>
           </View>
           <Text style={styles.bodyText}>{loyalty.lastVoucher.code}</Text>
           <Text style={styles.bodyMuted}>{formatPrice(loyalty.lastVoucher.valueRon)}</Text>
           {loyalty.lastVoucher.expiresAt ? (
             <Text style={styles.bodyMuted}>
               Expiră: {new Date(loyalty.lastVoucher.expiresAt).toLocaleDateString('ro-RO')}
             </Text>
           ) : null}
           {voucherQrToken ? (
            <View style={styles.stackSmall}>
              <TouchableOpacity
                style={styles.qrWrap}
                activeOpacity={0.9}
                onPress={onOpenVoucherQrPreview}
              >
                <QRCodeMatrix value={voucherQrToken} size={220} />
              </TouchableOpacity>
              <Text style={styles.bodyMuted}>
                Arată acest voucher la casă pentru a aplica reducerea.
              </Text>
              <View style={styles.loyaltyTokenActions}>
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
                  ]}
                  onPress={onShareVoucher}
                >
                  <Ionicons name="share-outline" size={16} color={colors.brandRed} />
                  <Text style={styles.secondaryButtonText}>Partajează voucherul</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : loyaltyQrLoading ? (
            <Text style={styles.bodyMuted}>Se generează codul QR...</Text>
          ) : (
            <>
              <Text style={styles.bodyMuted}>
                {loyaltyQrError ?? 'Codul QR nu este disponibil momentan.'}
              </Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={onRetryLoyaltyQr}>
                <Text style={styles.secondaryButtonText}>Reîncearcă generarea codului QR</Text>
              </TouchableOpacity>
            </>
          )}
         </View>
        ) : null}

      <TouchableOpacity
        style={[styles.primaryButton, { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }]}
        onPress={onRedeemVoucher}
        disabled={loyaltyBusy}
      >
        <Ionicons name="ticket-outline" size={16} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>
          {loyaltyBusy ? 'Se procesează...' : 'Generează voucher'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
