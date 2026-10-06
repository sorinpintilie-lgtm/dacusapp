import { useNavigation } from '@react-navigation/native';
import { useEffect, useLayoutEffect } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import type { DeviceSession } from '../services/commerce';
import { useApp } from '../state/AppProvider';
import { colors, spacing } from '../theme/tokens';
import { AppText, Badge, Button, EmptyState, IconButton, ListItem, ListSection } from '../ui';

const platformIcon = (platform: string) => {
  const value = platform.toLowerCase();
  if (value.includes('ios')) return 'logo-apple' as const;
  if (value.includes('android')) return 'logo-android' as const;
  return 'desktop-outline' as const;
};

export function DeviceSessionsScreen() {
  const navigation = useNavigation();
  const { accountUser, deviceSessions, refreshDeviceSessions, revokeSession } = useApp();

  useEffect(() => {
    refreshDeviceSessions();
  }, [refreshDeviceSessions]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <IconButton icon="close" accessibilityLabel="Închide" onPress={() => navigation.goBack()} size={36} />,
    });
  }, [navigation]);

  if (!accountUser) {
    return (
      <EmptyState
        icon="phone-portrait-outline"
        title="Intră în cont"
        message="Sesiunile active se văd după autentificare."
        actionLabel="Intră în cont"
        onAction={() => navigation.navigate('Login')}
      />
    );
  }

  const confirmRevoke = (session: DeviceSession) =>
    Alert.alert('Deconectezi dispozitivul?', `${session.platform.toUpperCase()} · ${session.deviceId}`, [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Deconectează', style: 'destructive', onPress: () => revokeSession(session.id) },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="subhead" tone="secondary" style={styles.intro}>
        Dispozitivele conectate la contul tău. Deconectează-le pe cele pe care nu le recunoști.
      </AppText>
      {deviceSessions.length === 0 ? (
        <EmptyState icon="phone-portrait-outline" title="Nicio sesiune activă" />
      ) : (
        <ListSection>
          {deviceSessions.map((session) => (
            <ListItem
              key={session.id}
              icon={platformIcon(session.platform)}
              title={session.platform.toUpperCase()}
              subtitle={`Activ ${new Date(session.lastSeenAt).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' })}`}
              right={
                session.current ? (
                  <Badge label="Acest dispozitiv" tone="success" />
                ) : (
                  <Button title="Deconectează" size="sm" variant="secondary" onPress={() => confirmRevoke(session)} />
                )
              }
            />
          ))}
        </ListSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl, backgroundColor: colors.grouped },
  intro: { paddingHorizontal: spacing.md },
});
