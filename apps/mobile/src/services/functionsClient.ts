import { httpsCallable } from 'firebase/functions';
import { getApp, initializeApp, type FirebaseApp } from 'firebase/app';

let functions: any = null;

const firebaseConfig = {
  apiKey: 'AIzaSyDcus-mobile-app-key',
  authDomain: 'dacus-b40f9.firebaseapp.com',
  projectId: 'dacus-b40f9',
  storageBucket: 'dacus-b40f9.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:mobile:0000000000000000000000',
  functionsDomain: 'us-central1-dacus-b40f9.cloudfunctions.net',
};

const initFunctions = async () => {
  if (!functions) {
    try {
      const app = getApp();
      const { getFunctions } = await import('firebase/functions');
      functions = getFunctions(app, 'us-central1');
    } catch {
      const app = initializeApp(firebaseConfig);
      const { getFunctions } = await import('firebase/functions');
      functions = getFunctions(app, 'us-central1');
    }
  }
  return functions;
};

const getFirebaseFunctions = async () => {
  if (!functions) {
    return await initFunctions();
  }
  return functions;
};

interface FirebaseUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface CartLine {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPriceRon?: number;
}

interface Address {
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

interface CatalogCategory {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
}

interface CatalogProduct {
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

interface CatalogResponse {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  hasMoreProducts: boolean;
  productsCursor: string | null;
  stamp: string | null;
  source: string;
}

interface AddressesResponse {
  addresses: Address[];
  selectedAddressId: string | null;
}

interface Order {
  id: string;
  userId: string;
  lines: CartLine[];
  totalRon: number;
  currency: string;
  status: string;
  trackingCode?: string;
  checkoutUrl?: string;
  addressId?: string;
  createdAt: string;
}

export const getCatalog = async (after?: string, pageSize = 250): Promise<CatalogResponse> => {
  const fns = await getFirebaseFunctions();
  const fn = httpsCallable(fns, 'getCatalog');
  const result = await fn({ after, pageSize });
  return result.data as CatalogResponse;
};

export const getAddresses = async (): Promise<AddressesResponse> => {
  const fns = await getFirebaseFunctions();
  const fn = httpsCallable(fns, 'getAddresses');
  const result = await fn(null);
  return result.data as AddressesResponse;
};

interface AddAddressInput {
  address: Omit<Address, 'id' | 'createdAt' | 'updatedAt'>;
}

export const addAddress = async (
  address: AddAddressInput['address'],
): Promise<{ address: Address }> => {
  const fns = await getFirebaseFunctions();
  const fn = httpsCallable(fns, 'addAddress');
  const result = await fn({ address });
  return result.data as { address: Address };
};

export const getCart = async (): Promise<CartLine[]> => {
  const fns = await getFirebaseFunctions();
  const fn = httpsCallable(fns, 'getCart');
  const result = await fn(null);
  return result.data as CartLine[];
};

interface AddToCartInput {
  line: CartLine;
}

export const addToCart = async (line: CartLine): Promise<CartLine[]> => {
  const fns = await getFirebaseFunctions();
  const fn = httpsCallable(fns, 'addToCart');
  const result = await fn({ line });
  return result.data as CartLine[];
};

interface RemoveFromCartInput {
  productId: string;
  variantId?: string;
}

export const removeFromCart = async (
  productId: string,
  variantId?: string,
): Promise<CartLine[]> => {
  const fns = await getFirebaseFunctions();
  const fn = httpsCallable(fns, 'removeFromCart');
  const result = await fn({ productId, variantId });
  return result.data as CartLine[];
};

interface ReplaceCartInput {
  lines: CartLine[];
}

export const replaceCart = async (input: ReplaceCartInput): Promise<CartLine[]> => {
  const fns = await getFirebaseFunctions();
  const fn = httpsCallable(fns, 'replaceCart');
  const result = await fn(input);
  return result.data as CartLine[];
};

export const getOrders = async (): Promise<Order[]> => {
  const fns = await getFirebaseFunctions();
  const fn = httpsCallable(fns, 'getOrders');
  const result = await fn(null);
  return result.data as Order[];
};

export const manualCatalogSync = async (): Promise<{
  ok: boolean;
  categories: number;
  products: number;
}> => {
  const fns = await getFirebaseFunctions();
  const fn = httpsCallable(fns, 'manualCatalogSync');
  const result = await fn(null);
  return result.data as { ok: boolean; categories: number; products: number };
};

export const authLogin = async (
  email: string,
  password: string,
): Promise<{ sessionToken: string; user: FirebaseUser }> => {
  const fns = await getFirebaseFunctions();
  const fn = httpsCallable(fns, 'authLogin');
  const result = await fn({ email, password });
  return result.data as { sessionToken: string; user: FirebaseUser };
};

export const authRegister = async (
  email: string,
  password: string,
  name: string,
): Promise<{ sessionToken: string; user: FirebaseUser }> => {
  const fns = await getFirebaseFunctions();
  const fn = httpsCallable(fns, 'authRegister');
  const result = await fn({ email, password, name });
  return result.data as { sessionToken: string; user: FirebaseUser };
};
