import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from './tokens';

// viewport and zoomCloseTop reserved for future animation use
// const viewport = Dimensions.get('window');
// const zoomCloseTop = spacing.lg;

export const appStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  headerWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#0B1020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoImage: { width: 88, height: 30 },
  searchWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  cartButton: {
    height: 34,
    minWidth: 78,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandRed,
  },
  cartButtonText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  scroll: { flex: 1, backgroundColor: colors.surfaceAlt },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 140 },
  stackLarge: { gap: spacing.lg },
  stackSmall: { gap: spacing.sm },
  pageHeading: {
    fontSize: typography.h2,
    fontWeight: '900',
    color: colors.textPrimary,
    lineHeight: 28,
  },
  sectionLabel: {
    fontSize: typography.h3,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 24,
  },
  bodyText: { fontSize: typography.body, color: colors.textPrimary },
  bodyMuted: { fontSize: typography.body, color: colors.textSecondary },
  emptyText: { color: colors.textSecondary, fontSize: typography.body },
  errorText: { color: colors.brandRed, fontSize: typography.caption },
  // Add more styles as needed
});
