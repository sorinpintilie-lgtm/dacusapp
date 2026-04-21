import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme/tokens';

type Page =
  | 'home'
  | 'categories'
  | 'products'
  | 'productDetails'
  | 'cart'
  | 'loyalty'
  | 'account'
  | 'settings'
  | 'login'
  | 'register';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface NavigationBarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  cartCount?: number;
}

const navConfig: Array<{ target: Page; label: string; icon: IconName; activeIcon?: IconName }> = [
  { target: 'home', label: 'Acasă', icon: 'view-dashboard-outline', activeIcon: 'view-dashboard' },
  { target: 'categories', label: 'Categorii', icon: 'shape-outline', activeIcon: 'shape' },
  { target: 'cart', label: 'Coș', icon: 'basket-outline', activeIcon: 'basket' },
  { target: 'loyalty', label: 'Fidelitate', icon: 'medal-outline', activeIcon: 'medal' },
  {
    target: 'account',
    label: 'Cont',
    icon: 'card-account-details-outline',
    activeIcon: 'card-account-details',
  },
];

// cartCount reserved for future use (cart badge)
export function NavigationBar({ currentPage, onNavigate }: NavigationBarProps) {
  const navItem = (target: Page, label: string, icon: IconName, activeIcon?: IconName) => {
    const active =
      target === currentPage ||
      (target === 'categories' &&
        (currentPage === 'products' || currentPage === 'productDetails')) ||
      (target === 'account' &&
        (currentPage === 'login' || currentPage === 'register' || currentPage === 'settings'));
    return (
      <TouchableOpacity key={target} style={styles.navItem} onPress={() => onNavigate(target)}>
        <MaterialCommunityIcons
          name={active && activeIcon ? activeIcon : icon}
          size={20}
          style={[styles.navIcon, active && styles.navIconActive]}
        />
        <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.bottomNav}>
      {navConfig.map((item) => navItem(item.target, item.label, item.icon, item.activeIcon))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    height: 68,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E6E9EE',
    flexDirection: 'row',
    shadowColor: '#0B1020',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 1 },
  navIcon: { color: colors.textSecondary, marginBottom: 2 },
  navIconActive: { color: colors.brandRed },
  navText: { color: colors.textSecondary, fontSize: typography.caption, fontWeight: '700' },
  navTextActive: { color: colors.brandRed },
});
