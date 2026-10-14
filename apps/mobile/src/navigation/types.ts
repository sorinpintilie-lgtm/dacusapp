import type { NavigatorScreenParams } from '@react-navigation/native';

import type { ProductListFilters } from '../state/productListFilters';

export type ProductListParams = {
  /** A whole department (several collections), with its collections as filter chips. */
  departmentId?: string;
  categoryId?: string;
  query?: string;
  title?: string;
  initialFilters?: Partial<ProductListFilters>;
};

export type HomeStackParamList = {
  Home: undefined;
  ProductList: ProductListParams;
};

export type CategoriesStackParamList = {
  Categories: undefined;
  ProductList: ProductListParams;
};

export type CartStackParamList = {
  Cart: undefined;
};

export type LoyaltyStackParamList = {
  Loyalty: undefined;
};

export type AccountStackParamList = {
  Account: undefined;
  Settings: undefined;
  Orders: undefined;
  Wishlist: undefined;
  Addresses: undefined;
  Inbox: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  CategoriesTab: NavigatorScreenParams<CategoriesStackParamList> | undefined;
  CartTab: NavigatorScreenParams<CartStackParamList> | undefined;
  LoyaltyTab: NavigatorScreenParams<LoyaltyStackParamList> | undefined;
  AccountTab: NavigatorScreenParams<AccountStackParamList> | undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Product: { productId: string };
  Search: { initialQuery?: string } | undefined;
  SearchResults: ProductListParams;
  Checkout: undefined;
  Login: undefined;
  Register: undefined;
  AddressEditor: { addressId?: string } | undefined;
  ImageViewer: { uri: string };
  QrCode: { token: string; title: string; subtitle?: string };
  DeviceSessions: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
