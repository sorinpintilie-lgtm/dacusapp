import * as FileSystem from 'expo-file-system/legacy';

import type { LiveCatalogPayload } from './storefront';

const cacheRoot = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? null;
const CATALOG_CACHE_FILE = cacheRoot ? `${cacheRoot}catalog-cache-v1.json` : null;

const isValidCatalogPayload = (value: unknown): value is LiveCatalogPayload => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<LiveCatalogPayload>;
  return (
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.products) &&
    typeof candidate.hasMoreProducts === 'boolean' &&
    (typeof candidate.productsCursor === 'string' || candidate.productsCursor === null)
  );
};

export const readCatalogCache = async (): Promise<LiveCatalogPayload | null> => {
  if (!CATALOG_CACHE_FILE) return null;

  try {
    const fileInfo = await FileSystem.getInfoAsync(CATALOG_CACHE_FILE);
    if (!fileInfo.exists) return null;

    const raw = await FileSystem.readAsStringAsync(CATALOG_CACHE_FILE);
    const parsed = JSON.parse(raw) as unknown;

    if (!isValidCatalogPayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeCatalogCache = async (payload: LiveCatalogPayload): Promise<void> => {
  if (!CATALOG_CACHE_FILE) return;

  try {
    await FileSystem.writeAsStringAsync(CATALOG_CACHE_FILE, JSON.stringify(payload));
  } catch {
    // no-op: cache write failures should never break app startup
  }
};

