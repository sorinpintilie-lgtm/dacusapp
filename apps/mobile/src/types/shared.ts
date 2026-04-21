/**
 * Shared type definitions for Dacus Mobile App
 * These types are used across the app and can be shared with the API
 */

// Catalog Types
export interface CatalogCategory {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
}

export interface CatalogProductVariant {
  id: string;
  name: string;
  priceRon: number;
  inStock: boolean;
}

export interface CatalogProduct {
  id: string;
  categoryId: string;
  categoryIds?: string[];
  handle?: string;
  sku?: string;
  variantId?: string;
  name: string;
  brand: string;
  description?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  priceRon: number;
  oldPriceRon?: number;
  stockLabel: string;
  variants?: CatalogProductVariant[];
}

// Commerce Types
export interface CartLine {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPriceRon?: number;
}

export interface Order {
  id: string;
  lines: CartLine[];
  totalRon: number;
  currency: string;
  status: 'created' | 'processing' | 'shipped';
  trackingCode?: string;
  checkoutUrl?: string;
  externalCheckoutId?: string;
  addressId?: string;
  createdAt: string;
}

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  county: string;
  postalCode: string;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
}

export type AddressDraft = Pick<
  Address,
  'label' | 'fullName' | 'phone' | 'line1' | 'line2' | 'city' | 'county' | 'postalCode' | 'countryCode'
>;

// Loyalty Types
export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold';

export interface LoyaltyVoucherWalletEntry {
  code: string;
  valueRon: number;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'used' | 'expired';
  usedAt?: string;
  receiptId?: string;
}

export interface LoyaltySummary {
  points: number;
  tier: LoyaltyTier;
  nextTierSpendRon: number;
  voucherWallet?: {
    active: LoyaltyVoucherWalletEntry[];
    expiringSoon: LoyaltyVoucherWalletEntry[];
    used: LoyaltyVoucherWalletEntry[];
    expired: LoyaltyVoucherWalletEntry[];
  };
  lastVoucher?: {
    code: string;
    valueRon: number;
    createdAt?: string;
    expiresAt?: string;
    qrToken?: string;
  };
  loyaltyQrToken?: string;
  loyaltyQrCreatedAt?: string;
}

export interface LoyaltyVoucher {
  code: string;
  valueRon: number;
  pointsRedeemed: number;
  createdAt: string;
  expiresAt: string;
  qrToken?: string;
}

// Search Types
export interface SearchFacet {
  field_name: string;
  counts: Array<{ value: string; count: number }>;
}

export interface ProductSearchPayload {
  products: CatalogProduct[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
  facets: SearchFacet[];
  source?: string;
}

// Notification Types
export interface InboxNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
}

// Device Types
export interface DeviceSession {
  id: string;
  deviceId: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  current?: boolean;
}

// Filter Types
export type SortOption = 'relevanta' | 'pretCrescator' | 'pretDescrescator' | 'numeAZ';
export type PriceFilterOption = 'toate' | 'sub200' | 'intre200si500' | 'intre500si1000' | 'peste1000';

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

// API Response Types
export interface ApiError {
  error: string;
  errorRo?: string;
  code?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// Cart Validation Types
export interface CartValidationIssue {
  lineKey: string;
  productId: string;
  variantId?: string;
  code:
    | 'invalid_product_id'
    | 'invalid_quantity'
    | 'product_not_found'
    | 'variant_not_found'
    | 'out_of_stock'
    | 'price_mismatch';
  message: string;
  messageRo: string;
  expectedUnitPriceRon?: number;
  providedUnitPriceRon?: number;
}

export interface CartValidationResult {
  ok: boolean;
  issues: CartValidationIssue[];
  lines: CartLine[];
  totalRon: number;
}

// Order Details
export interface OrderDetailsPayload {
  order: Order;
  address?: Address;
}

export interface AddressesPayload {
  addresses: Address[];
  selectedAddressId: string | null;
}
