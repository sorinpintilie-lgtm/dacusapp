import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFunctions, Functions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let functions: Functions | null = null;

const getFirebaseFunctions = (): Functions => {
  if (!functions) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    functions = getFunctions(app, 'europe-west1');
  }
  return functions;
};

// ========== AUTH ==========
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface LoginResult {
  sessionToken: string;
  user: AuthUser;
}

export const firebaseLogin = async (email: string, password: string): Promise<LoginResult> => {
  const fn = httpsCallable(getFirebaseFunctions(), 'authLogin');
  const result = (await fn({ email, password })) as { data: LoginResult };
  return result.data;
};

export const firebaseRegister = async (
  email: string,
  password: string,
  name: string,
): Promise<LoginResult> => {
  const fn = httpsCallable(getFirebaseFunctions(), 'authRegister');
  const result = (await fn({ email, password, name })) as { data: LoginResult };
  return result.data;
};

// ========== CART ==========
export interface CartLine {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPriceRon?: number;
}

export const firebaseGetCart = async (): Promise<CartLine[]> => {
  const fn = httpsCallable(getFirebaseFunctions(), 'getCart');
  const result = (await fn(null)) as { data: CartLine[] };
  return result.data;
};

export const firebaseAddToCart = async (line: CartLine): Promise<CartLine[]> => {
  const fn = httpsCallable(getFirebaseFunctions(), 'addToCart');
  const result = (await fn({ line })) as { data: CartLine[] };
  return result.data;
};

export const firebaseRemoveFromCart = async (
  productId: string,
  variantId?: string,
): Promise<CartLine[]> => {
  const fn = httpsCallable(getFirebaseFunctions(), 'removeFromCart');
  const result = (await fn({ productId, variantId })) as { data: CartLine[] };
  return result.data;
};

// ========== CATALOG ==========
export interface CatalogProduct {
  id: string;
  categoryId: string;
  categoryIds?: string[];
  handle?: string;
  name: string;
  brand: string;
  description?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  priceRon: number;
  oldPriceRon?: number;
  stockLabel: string;
  variants?: Array<{
    id: string;
    name: string;
    priceRon: number;
    inStock: boolean;
  }>;
}

export interface CatalogCategory {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
}

export interface CatalogPayload {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  hasMoreProducts: boolean;
  productsCursor: string | null;
  stamp: string | null;
  source: string;
}

export const firebaseGetCatalog = async (
  after?: string,
  pageSize?: number,
): Promise<CatalogPayload> => {
  const fn = httpsCallable(getFirebaseFunctions(), 'getCatalog');
  const result = (await fn({ after, pageSize })) as { data: CatalogPayload };
  return result.data;
};

export const firebaseSyncCatalog = async (): Promise<{ ok: boolean; message: string }> => {
  const fn = httpsCallable(getFirebaseFunctions(), 'manualCatalogSync');
  const result = (await fn(null)) as { data: { ok: boolean; message: string } };
  return result.data;
};

// ========== ADDRESSES ==========
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
}

export const firebaseGetAddresses = async (): Promise<{
  addresses: Address[];
  selectedAddressId: string | null;
}> => {
  const fn = httpsCallable(getFirebaseFunctions(), 'getAddresses');
  const result = (await fn(null)) as {
    data: { addresses: Address[]; selectedAddressId: string | null };
  };
  return result.data;
};

export const firebaseAddAddress = async (
  address: Omit<Address, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<{ address: Address }> => {
  const fn = httpsCallable(getFirebaseFunctions(), 'addAddress');
  const result = (await fn({ address })) as { data: { address: Address } };
  return result.data;
};

// ========== ORDERS ==========
export const firebaseGetOrders = async (): Promise<unknown[]> => {
  const fn = httpsCallable(getFirebaseFunctions(), 'getOrders');
  const result = (await fn(null)) as { data: unknown[] };
  return result.data;
};
