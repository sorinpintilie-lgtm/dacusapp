import QRCodeMatrix from '../components/QRCodeMatrix';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Skeleton } from '../components/Skeleton';
import type { LoyaltySummary } from '../services/commerce';
import { formatPrice } from '../utils/catalogFilters';
import type { ScreenStyles } from './screenTypes';

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
}: LoyaltyScreenProps) =>
{
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
          <Text style={styles.loyaltyTitle}>Program de fidelitate</Text>
          <Text style={styles.loyaltyTierTag}>{loyalty.tier}</Text>
        </View>

        <Text style={styles.loyaltyPoints}>{loyalty.points.toLocaleString('ro-RO')} puncte</Text>
        <Text style={styles.loyaltyMeta}>1 punct = 1 RON cheltuit • 100 puncte = 5 RON voucher</Text>

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
        <TouchableOpacity style={styles.secondaryButton} onPress={onRefreshLoyalty} disabled={loyaltyRefreshing || loyaltyBusy}>
          <Text style={styles.secondaryButtonText}>{loyaltyRefreshing ? 'Se actualizează...' : 'Reîmprospătează'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardPlain}>
        <Text style={styles.sectionLabel}>Valoare voucher dorită</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
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
        <Text style={styles.bodyMuted}>Ai nevoie de {loyaltyRedeemPoints} puncte pentru selecția curentă.</Text>
      </View>

      <View style={styles.loyaltyStatRow}>
        <View style={styles.loyaltyStatCard}>
          <Text style={styles.loyaltyStatLabel}>Valoare voucher disponibilă</Text>
          <Text style={styles.loyaltyStatValue}>{formatPrice(voucherValueRon)}</Text>
        </View>
        <View style={styles.loyaltyStatCard}>
          <Text style={styles.loyaltyStatLabel}>Puncte necesare / voucher</Text>
          <Text style={styles.loyaltyStatValue}>100</Text>
        </View>
      </View>

      <View style={styles.cardPlain}>
        <Text style={styles.sectionLabel}>Niveluri</Text>
        {loyaltyTiers.map((tier) => {
          const active = tier.name === loyalty.tier;
          return (
            <View key={tier.name} style={styles.tierRow}>
              <Text style={[styles.tierName, active && styles.tierNameActive]}>{tier.name}</Text>
              <Text style={styles.tierRange}>
                {tier.max === Number.POSITIVE_INFINITY ? `${tier.min}+ RON` : `${tier.min} - ${tier.max} RON`}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.cardPlain}>
        <Text style={styles.sectionLabel}>Beneficii nivel curent</Text>
        <Text style={styles.bodyMuted}>{tierBenefitText}</Text>
      </View>

      {loyalty.voucherWallet ? (
        <View style={styles.cardPlain}>
          <Text style={styles.sectionLabel}>Wallet vouchere</Text>
          <Text style={styles.bodyMuted}>Active: {loyalty.voucherWallet.active.length}</Text>
          <Text style={styles.bodyMuted}>Expiră curând: {loyalty.voucherWallet.expiringSoon.length}</Text>
          <Text style={styles.bodyMuted}>Utilizate: {loyalty.voucherWallet.used.length}</Text>
          <Text style={styles.bodyMuted}>Expirate: {loyalty.voucherWallet.expired.length}</Text>
          {loyalty.voucherWallet.active.slice(0, 3).map((item) => (
            <View key={item.code} style={styles.tierRow}>
              <Text style={styles.tierName}>{item.code}</Text>
              <Text style={styles.tierRange}>{formatPrice(item.valueRon)} • {new Date(item.expiresAt).toLocaleDateString('ro-RO')}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {loyalty.lastVoucher ? (
        <View style={styles.cardPlain}>
          <Text style={styles.sectionLabel}>Ultimul voucher</Text>
          <Text style={styles.bodyText}>{loyalty.lastVoucher.code}</Text>
          <Text style={styles.bodyMuted}>{formatPrice(loyalty.lastVoucher.valueRon)}</Text>
          {loyalty.lastVoucher.expiresAt ? (
            <Text style={styles.bodyMuted}>Expiră: {new Date(loyalty.lastVoucher.expiresAt).toLocaleDateString('ro-RO')}</Text>
          ) : null}
          {voucherQrToken ? (
            <View style={styles.stackSmall}>
              <TouchableOpacity style={styles.qrWrap} activeOpacity={0.9} onPress={onOpenVoucherQrPreview}>
                <QRCodeMatrix value={voucherQrToken} size={220} />
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity style={styles.secondaryButton} onPress={onShareVoucher}>
            <Text style={styles.secondaryButtonText}>Partajează voucherul</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.cardPlain}>
        <Text style={styles.sectionLabel}>Codul tău de membru</Text>
        {loyaltyQrToken ? (
          <>
            <TouchableOpacity style={styles.qrWrap} activeOpacity={0.9} onPress={onOpenLoyaltyQrPreview}>
              <QRCodeMatrix value={loyaltyQrToken} size={220} />
            </TouchableOpacity>
            <Text style={styles.bodyMuted}>Arată acest cod la casă pentru puncte și beneficii.</Text>
            <View style={styles.loyaltyTokenActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={onShareQrToken}>
                <Text style={styles.secondaryButtonText}>Partajează codul</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : loyaltyQrLoading ? (
          <Text style={styles.bodyMuted}>Se generează codul QR...</Text>
        ) : (
          <>
            <Text style={styles.bodyMuted}>{loyaltyQrError ?? 'Codul QR nu este disponibil momentan.'}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={onRetryLoyaltyQr}>
              <Text style={styles.secondaryButtonText}>Reîncearcă generarea codului QR</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={onRedeemVoucher} disabled={loyaltyBusy}>
        <Text style={styles.primaryButtonText}>{loyaltyBusy ? 'Se procesează...' : 'Generează voucher'}</Text>
      </TouchableOpacity>
    </View>
  );
};

