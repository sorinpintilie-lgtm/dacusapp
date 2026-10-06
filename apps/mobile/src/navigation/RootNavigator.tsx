import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountScreen } from '../screens/AccountScreen';
import { AddressEditorScreen } from '../screens/AddressEditorScreen';
import { AddressesScreen } from '../screens/AddressesScreen';
import { CartScreen } from '../screens/CartScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { DeviceSessionsScreen } from '../screens/DeviceSessionsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ImageViewerScreen } from '../screens/ImageViewerScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { LoyaltyScreen } from '../screens/LoyaltyScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { ProductListScreen } from '../screens/ProductListScreen';
import { ProductScreen } from '../screens/ProductScreen';
import { QrCodeScreen } from '../screens/QrCodeScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { WishlistScreen } from '../screens/WishlistScreen';
import { useApp } from '../state/AppProvider';
import { colors, fonts } from '../theme/tokens';
import { haptics } from '../ui/haptics';
import { TabIcon } from './TabIcon';
import type {
  AccountStackParamList,
  CartStackParamList,
  CategoriesStackParamList,
  HomeStackParamList,
  LoyaltyStackParamList,
  MainTabParamList,
  RootStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const CategoriesStack = createNativeStackNavigator<CategoriesStackParamList>();
const CartStack = createNativeStackNavigator<CartStackParamList>();
const LoyaltyStack = createNativeStackNavigator<LoyaltyStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();

const stackOptions: NativeStackNavigationOptions = {
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.textPrimary },
  headerLargeTitleStyle: { fontFamily: fonts.bold, color: colors.textPrimary },
  headerStyle: { backgroundColor: colors.canvas },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: colors.canvas },
  freezeOnBlur: true,
};

/** Screens made of grouped white sections sit on the warm grey canvas. */
const groupedOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.grouped },
  headerLargeStyle: { backgroundColor: colors.grouped },
  contentStyle: { backgroundColor: colors.grouped },
};

// Tab roots use iOS large titles that shrink into the bar on scroll.
const largeTitleOptions: NativeStackNavigationOptions = {
  headerLargeTitle: true,
  headerLargeTitleShadowVisible: false,
};

// A category's products are listed by id so opening a second category pushes a new list.
const productListId = ({ params }: { params: { categoryId?: string; query?: string } }) =>
  params.categoryId ?? params.query;

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={stackOptions}>
      <HomeStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="ProductList" component={ProductListScreen} getId={productListId} />
    </HomeStack.Navigator>
  );
}

function CategoriesStackScreen() {
  return (
    <CategoriesStack.Navigator screenOptions={stackOptions}>
      <CategoriesStack.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{ title: 'Categorii', ...largeTitleOptions }}
      />
      <CategoriesStack.Screen name="ProductList" component={ProductListScreen} getId={productListId} />
    </CategoriesStack.Navigator>
  );
}

function CartStackScreen() {
  return (
    <CartStack.Navigator screenOptions={stackOptions}>
      <CartStack.Screen
        name="Cart"
        component={CartScreen}
        options={{ title: 'Coșul meu', ...largeTitleOptions }}
      />
    </CartStack.Navigator>
  );
}

function LoyaltyStackScreen() {
  return (
    <LoyaltyStack.Navigator screenOptions={stackOptions}>
      <LoyaltyStack.Screen
        name="Loyalty"
        component={LoyaltyScreen}
        options={{ title: 'Fidelitate', ...largeTitleOptions, ...groupedOptions }}
      />
    </LoyaltyStack.Navigator>
  );
}

function AccountStackScreen() {
  return (
    <AccountStack.Navigator screenOptions={{ ...stackOptions, ...groupedOptions }}>
      <AccountStack.Screen name="Account" component={AccountScreen} options={{ title: 'Contul meu', ...largeTitleOptions }} />
      <AccountStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Setări' }} />
      <AccountStack.Screen name="Orders" component={OrdersScreen} options={{ title: 'Comenzile mele' }} />
      <AccountStack.Screen
        name="Wishlist"
        component={WishlistScreen}
        options={{ title: 'Favorite', headerStyle: { backgroundColor: colors.canvas }, contentStyle: { backgroundColor: colors.canvas } }}
      />
      <AccountStack.Screen name="Addresses" component={AddressesScreen} options={{ title: 'Adrese de livrare' }} />
      <AccountStack.Screen name="Inbox" component={InboxScreen} options={{ title: 'Notificări' }} />
    </AccountStack.Navigator>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcons: Record<keyof MainTabParamList, [IconName, IconName]> = {
  HomeTab: ['home', 'home-outline'],
  CategoriesTab: ['grid', 'grid-outline'],
  CartTab: ['bag-handle', 'bag-handle-outline'],
  LoyaltyTab: ['gift', 'gift-outline'],
  AccountTab: ['person', 'person-outline'],
};

// Taller than the platform default (49) so the icon box (28), its badge and the label never crowd each other.
const TAB_BAR_HEIGHT = 60;

function MainTabs() {
  const { cartCount } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        freezeOnBlur: true,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarIcon: ({ focused, color }) => (
          <TabIcon
            name={tabIcons[route.name][focused ? 0 : 1]}
            focused={focused}
            color={color}
            badge={route.name === 'CartTab' ? cartCount : 0}
          />
        ),
      })}
      screenListeners={{ tabPress: () => haptics.selection() }}
    >
      <Tabs.Screen name="HomeTab" component={HomeStackScreen} options={{ title: 'Acasă' }} />
      <Tabs.Screen name="CategoriesTab" component={CategoriesStackScreen} options={{ title: 'Categorii' }} />
      <Tabs.Screen
        name="CartTab"
        component={CartStackScreen}
        options={{ title: 'Coș', tabBarAccessibilityLabel: cartCount > 0 ? `Coș, ${cartCount} produse` : 'Coș' }}
      />
      <Tabs.Screen name="LoyaltyTab" component={LoyaltyStackScreen} options={{ title: 'Fidelitate' }} />
      <Tabs.Screen name="AccountTab" component={AccountStackScreen} options={{ title: 'Cont' }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  return (
    <RootStack.Navigator screenOptions={stackOptions}>
      <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <RootStack.Screen
        name="Product"
        component={ProductScreen}
        getId={({ params }) => params.productId}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Căutare', headerShown: false, animation: 'fade' }}
      />
      <RootStack.Screen name="SearchResults" component={ProductListScreen} getId={productListId} />
      <RootStack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ title: 'Finalizare comandă', ...groupedOptions }}
      />
      <RootStack.Group screenOptions={{ presentation: 'modal' }}>
        <RootStack.Screen name="Login" component={LoginScreen} options={{ title: '' }} />
        <RootStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Cont nou' }} />
        <RootStack.Screen
          name="AddressEditor"
          component={AddressEditorScreen}
          options={{ title: 'Adresă de livrare', ...groupedOptions }}
        />
        <RootStack.Screen
          name="DeviceSessions"
          component={DeviceSessionsScreen}
          options={{ title: 'Sesiuni active', ...groupedOptions }}
        />
      </RootStack.Group>
      <RootStack.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade', headerShown: false }}
      />
      <RootStack.Screen
        name="QrCode"
        component={QrCodeScreen}
        options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false }}
      />
    </RootStack.Navigator>
  );
}
