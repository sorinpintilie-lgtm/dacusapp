import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { colors, typography, radii, spacing } from '../theme/tokens';

type Page =
  | 'home'
  | 'categories'
  | 'products'
  | 'productDetails'
  | 'cart'
  | 'checkout'
  | 'loyalty'
  | 'account'
  | 'settings'
  | 'login'
  | 'register';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface NavigationBarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  cartCount?: number;
}

const navConfig: Array<{ target: Page; label: string; icon: IconName; activeIcon: IconName }> = [
  { target: 'home', label: 'Acasă', icon: 'home-outline', activeIcon: 'home' },
  { target: 'categories', label: 'Categorii', icon: 'grid-outline', activeIcon: 'grid' },
  { target: 'cart', label: 'Coș', icon: 'cart-outline', activeIcon: 'cart' },
  { target: 'loyalty', label: 'Fidelitate', icon: 'star-outline', activeIcon: 'star' },
  { target: 'account', label: 'Cont', icon: 'person-outline', activeIcon: 'person' },
];

function CartBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.cartBadge}>
      <Text style={styles.cartBadgeText}>{count > 99 ? '99+' : count.toString()}</Text>
    </View>
  );
}

export function NavigationBar({ currentPage, onNavigate, cartCount = 0 }: NavigationBarProps) {
  const navItem = (target: Page, label: string, icon: IconName, activeIcon: IconName) => {
    const active =
      target === currentPage ||
      (target === 'categories' &&
        (currentPage === 'products' || currentPage === 'productDetails')) ||
      (target === 'account' &&
        (currentPage === 'login' || currentPage === 'register' || currentPage === 'settings'));

    return (
      <Pressable
        key={target}
        style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
        onPress={() => onNavigate(target)}
        android_ripple={{ color: 'rgba(227, 6, 19, 0.08)', borderless: true }}
      >
        <View style={styles.iconWrapper}>
          <Ionicons
            name={active ? activeIcon : icon}
            size={22}
            style={[styles.navIcon, active && styles.navIconActive]}
          />
          {target === 'cart' && cartCount > 0 && <CartBadge count={cartCount} />}
        </View>
        <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
        {active && <View style={styles.activeIndicator} />}
      </Pressable>
    );
  };

  return (
    <View style={styles.bottomNav}>
      {navConfig.map((item) => navItem(item.target, item.label, item.icon, item.activeIcon))}
    </View>
  );
}

const BADGE_SIZE = 18;

const styles = StyleSheet.create({
  bottomNav: {
    height: 64,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    ...Platform.select({
      ios: {
        shadowColor: '#0B1020',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.xxs,
    position: 'relative',
  },
  navItemPressed: {
    opacity: 0.7,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    color: colors.textSecondary,
    marginBottom: 2,
  },
  navIconActive: {
    color: colors.brandRed,
  },
  navText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  navTextActive: {
    color: colors.brandRed,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    top: 2,
    left: '50%',
    transform: [{ translateX: -12 }],
    width: 24,
    height: 3,
    backgroundColor: colors.brandRed,
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    backgroundColor: colors.brandRed,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  cartBadgeText: {
    color: colors.textInverted,
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
