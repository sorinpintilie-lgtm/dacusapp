import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import type { Order } from '../services/commerce';
import { useApp } from '../state/AppProvider';
import { colors, continuous, radii, spacing } from '../theme/tokens';
import { AppText, Badge, EmptyState, hasImageUrl, Touchable, type BadgeTone } from '../ui';
import { formatPrice } from '../utils/catalogFilters';
import { productCount } from '../utils/string';

const STATUS: Record<Order['status'], { label: string; tone: BadgeTone; step: number }> = {
  created: { label: 'Plasată', tone: 'neutral', step: 0 },
  processing: { label: 'În procesare', tone: 'warning', step: 1 },
  shipped: { label: 'Expediată', tone: 'success', step: 2 },
};
const STEPS = ['Plasată', 'În procesare', 'Expediată'];

export function OrdersScreen() {
  const navigation = useNavigation();
  const { accountUser, orders, orderDetailsById, loadOrderDetails, productsById } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!accountUser) {
    return (
      <EmptyState
        icon="receipt-outline"
        title="Intră în cont"
        message="Comenzile tale apar aici după autentificare."
        actionLabel="Intră în cont"
        onAction={() => navigation.navigate('Login')}
      />
    );
  }

  const renderOrder: ListRenderItem<Order> = ({ item }) => {
    const status = STATUS[item.status] ?? STATUS.created;
    const expanded = expandedId === item.id;
    const details = orderDetailsById[item.id];
    const quantity = item.lines.reduce((sum, line) => sum + line.quantity, 0);
    const thumbnails = item.lines
      .map((line) => productsById.get(line.productId))
      .filter((product) => !!product)
      .slice(0, 4);

    return (
      <Touchable
        pressedScale={0.99}
        style={styles.card}
        onPress={() => {
          setExpandedId(expanded ? null : item.id);
          if (!expanded) void loadOrderDetails(item.id);
        }}
        accessibilityLabel={`Comanda ${item.id}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.flex}>
            <AppText variant="headline" numberOfLines={1}>
              Comanda {item.id.replace(/^ORD-/, '#')}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {new Date(item.createdAt).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })},{' '}
              {productCount(quantity)}
            </AppText>
          </View>
          <Badge label={status.label} tone={status.tone} />
        </View>

        {thumbnails.length > 0 ? (
          <View style={styles.thumbs}>
            {thumbnails.map((product) =>
              product && hasImageUrl(product.thumbnailUrl) ? (
                <Image key={product.id} source={product.thumbnailUrl} style={styles.thumb} contentFit="contain" />
              ) : null,
            )}
          </View>
        ) : null}

        <View style={styles.timeline}>
          {STEPS.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.stepDot, index <= status.step && styles.stepDotDone]} />
              <AppText variant="caption" tone={index <= status.step ? 'primary' : 'tertiary'}>
                {step}
              </AppText>
            </View>
          ))}
        </View>

        <View style={styles.cardFooter}>
          <AppText variant="headline">{formatPrice(item.totalRon)}</AppText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
        </View>

        {expanded ? (
          <View style={styles.details}>
            {item.trackingCode ? <DetailRow label="Cod de urmărire" value={item.trackingCode} /> : null}
            <DetailRow label="Livrare la" value={details?.address ? `${details.address.label}, ${details.address.city}` : 'Se încarcă...'} />
            {item.lines.map((line) => (
              <DetailRow
                key={`${line.productId}-${line.variantId ?? ''}`}
                label={`${line.quantity} ×`}
                value={productsById.get(line.productId)?.name ?? 'Produs'}
              />
            ))}
          </View>
        ) : null}
      </Touchable>
    );
  };

  return (
    <FlatList
      data={orders}
      keyExtractor={(order) => order.id}
      renderItem={renderOrder}
      contentContainerStyle={styles.content}
      ListEmptyComponent={
        <EmptyState
          icon="receipt-outline"
          title="Nu ai comenzi încă"
          message="Comenzile plasate din aplicație apar aici."
          actionLabel="Începe cumpărăturile"
          onAction={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
        />
      }
    />
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <AppText variant="subhead" tone="secondary">
        {label}
      </AppText>
      <AppText variant="subhead" style={styles.detailValue} numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  flex: { flex: 1, gap: 2 },
  card: { backgroundColor: colors.surface, borderRadius: radii.md, ...continuous, padding: spacing.md, gap: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  thumbs: { flexDirection: 'row', gap: spacing.xs },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    ...continuous,
    backgroundColor: colors.well,
  },
  timeline: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lineStrong },
  stepDotDone: { backgroundColor: colors.ink },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  details: {
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
  },
  detailRow: { flexDirection: 'row', gap: spacing.sm },
  detailValue: { flex: 1, textAlign: 'right' },
});
