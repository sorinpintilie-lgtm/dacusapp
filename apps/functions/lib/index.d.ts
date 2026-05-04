import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
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
interface CartLine {
    productId: string;
    variantId?: string;
    quantity: number;
    unitPriceRon?: number;
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
interface CatalogCategory {
    id: string;
    name: string;
    description: string;
    imageUrl?: string;
}
export declare const getCatalog: functions.https.CallableFunction<any, Promise<{
    categories: CatalogCategory[];
    products: CatalogProduct[];
    hasMoreProducts: boolean;
    productsCursor: string;
    stamp: any;
    source: string;
}>, unknown>;
export declare const getCart: functions.https.CallableFunction<any, Promise<CartLine[]>, unknown>;
export declare const replaceCart: functions.https.CallableFunction<any, Promise<CartLine[]>, unknown>;
export declare const addToCart: functions.https.CallableFunction<any, Promise<CartLine[]>, unknown>;
export declare const removeFromCart: functions.https.CallableFunction<any, Promise<CartLine[]>, unknown>;
export declare const getAddresses: functions.https.CallableFunction<any, Promise<{
    addresses: Address[];
    selectedAddressId: any;
}>, unknown>;
export declare const addAddress: functions.https.CallableFunction<any, Promise<{
    address: Address;
}>, unknown>;
export declare const getOrders: functions.https.CallableFunction<any, Promise<admin.firestore.DocumentData[]>, unknown>;
export declare const manualCatalogSync: functions.https.CallableFunction<any, Promise<{
    ok: boolean;
    categories: number;
    products: number;
}>, unknown>;
export declare const sendPushNotification: functions.https.CallableFunction<any, Promise<{
    ok: boolean;
    queued: boolean;
    sent?: undefined;
} | {
    ok: boolean;
    sent: boolean;
    queued?: undefined;
}>, unknown>;
export declare const registerPushToken: functions.https.CallableFunction<any, Promise<{
    ok: boolean;
}>, unknown>;
export {};
