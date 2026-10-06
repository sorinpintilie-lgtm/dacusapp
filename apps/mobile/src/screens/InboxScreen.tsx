import { useNavigation } from '@react-navigation/native';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import type { InboxNotification } from '../services/commerce';
import { useApp } from '../state/AppProvider';
import { colors, continuous, radii, spacing } from '../theme/tokens';
import { AppText, EmptyState, Touchable } from '../ui';
import { fixRomanianMojibake } from '../utils/string';

export function InboxScreen() {
  const navigation = useNavigation();
  const { accountUser, inbox, markInboxRead } = useApp();

  if (!accountUser) {
    return (
      <EmptyState
        icon="notifications-outline"
        title="Intră în cont"
        message="Notificările despre comenzi și puncte apar aici."
        actionLabel="Intră în cont"
        onAction={() => navigation.navigate('Login')}
      />
    );
  }

  const renderItem: ListRenderItem<InboxNotification> = ({ item }) => {
    const unread = !item.readAt;
    return (
      <Touchable
        onPress={() => (unread ? markInboxRead(item.id) : undefined)}
        pressedScale={0.99}
        style={styles.card}
        accessibilityLabel={item.title}
      >
        <View style={[styles.dot, unread ? styles.dotUnread : null]} />
        <View style={styles.texts}>
          <AppText variant={unread ? 'headline' : 'bodyMedium'}>{fixRomanianMojibake(item.title)}</AppText>
          <AppText variant="subhead" tone="secondary">
            {fixRomanianMojibake(item.message)}
          </AppText>
          <AppText variant="caption" tone="tertiary">
            {new Date(item.createdAt).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' })}
          </AppText>
        </View>
      </Touchable>
    );
  };

  return (
    <FlatList
      data={inbox}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.content}
      ListEmptyComponent={
        <EmptyState icon="notifications-outline" title="Nicio notificare" message="Te anunțăm aici despre comenzi și puncte." />
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    ...continuous,
    padding: spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: 'transparent' },
  dotUnread: { backgroundColor: colors.brand },
  texts: { flex: 1, gap: 3 },
});
