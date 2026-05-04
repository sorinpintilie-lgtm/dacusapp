import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CatalogCategory, CatalogProduct } from '../data/catalog';
import { readCatalogCacheEntry, writeCatalogCache } from '../services/catalogCache';
import {
  loadCatalogStamp,
  loadLiveCatalog,
  streamLiveCatalogProductsAfterCursor,
} from '../services/storefront';
import { buildProductIndexes } from '../utils/catalogFilters';

const CATALOG_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours (once per day at 2 AM)
const INITIAL_PAGE_SIZE = 250;

type CatalogState = {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  selectedCategoryId: string;
  selectedProductId: string;
  catalogLoading: boolean;
  catalogError: string | null;
  catalogMeta: string;
  setCatalogError: (value: string | null) => void;
  setCatalogMeta: (value: string) => void;
  upsertProducts: (items: CatalogProduct[]) => void;
  setSelectedCategoryId: (value: string) => void;
  setSelectedProductId: (value: string) => void;
  selectedCategory?: CatalogCategory;
  selectedProduct?: CatalogProduct;
  countByCategory: Map<string, number>;
  productsById: Map<string, CatalogProduct>;
};

const mergeProductsById = (base: CatalogProduct[], incoming: CatalogProduct[]) => {
  const merged = new Map(base.map((item) => [item.id, item]));
  incoming.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
};

export const useCatalog = (): CatalogState => {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogMeta, setCatalogMeta] = useState('Catalog live: se încarcă...');

  const upsertProducts = useCallback((items: CatalogProduct[]) => {
    if (!Array.isArray(items) || items.length === 0) return;
    setProducts((prev) => {
      const merged = new Map(prev.map((item) => [item.id, item]));
      items.forEach((item) => merged.set(item.id, item));
      return Array.from(merged.values());
    });
  }, []);

  useEffect(() => {
    let active = true;

    const hydrateCatalog = async () => {
      console.log('[BOOT][useCatalog] hydrateCatalog start');
      const cachedEntry = await readCatalogCacheEntry();
      const cached = cachedEntry?.payload ?? null;
      const now = Date.now();

      const collectInvalidProductShape = (items: unknown[]) =>
        items.filter((item) => {
          if (!item || typeof item !== 'object') return true;
          const candidate = item as {
            id?: unknown;
            brand?: unknown;
            stockLabel?: unknown;
            priceRon?: unknown;
          };
          return (
            typeof candidate.id !== 'string' ||
            candidate.id.length === 0 ||
            typeof candidate.brand !== 'string' ||
            candidate.brand.length === 0 ||
            typeof candidate.stockLabel !== 'string' ||
            typeof candidate.priceRon !== 'number' ||
            !Number.isFinite(candidate.priceRon)
          );
        });

      const loadRemainingCatalogPages = async (params: {
        startCursor: string | null;
        seedProducts: CatalogProduct[];
        seedCategories: CatalogCategory[];
        stamp: string | null;
      }) => {
        if (!params.startCursor) return;

        let mergedProducts = params.seedProducts;
        let streamedSoFar = 0;

        try {
          const streamedTotal = await streamLiveCatalogProductsAfterCursor(
            params.startCursor,
            (pageProducts, loadedTotal) => {
              streamedSoFar = loadedTotal;
              if (!active || pageProducts.length === 0) return;

              setProducts((prev) => {
                mergedProducts = mergeProductsById(prev, pageProducts);
                return mergedProducts;
              });

              setCatalogMeta(
                `Catalog live: ${params.seedProducts.length + loadedTotal} produse încărcate.`,
              );
            },
            { pageSize: 150, leanQuery: true },
          );

          if (!active) return;

          const finalTotal = params.seedProducts.length + streamedTotal;
          setCatalogMeta(`Catalog live: ${finalTotal} produse încărcate.`);

          if (mergedProducts.length > 0) {
            await writeCatalogCache(
              {
                categories: params.seedCategories,
                products: mergedProducts,
                hasMoreProducts: false,
                productsCursor: null,
              },
              { stamp: params.stamp },
            );
          }
        } catch {
          if (!active) return;

          setCatalogMeta(
            streamedSoFar > 0
              ? `Catalog live: ${params.seedProducts.length + streamedSoFar} produse încărcate (sync parțial).`
              : `Catalog live: ${params.seedProducts.length} produse încărcate (sync extins indisponibil).`,
          );
        }
      };

      if (active && cached) {
        const invalidCachedProducts = collectInvalidProductShape(cached.products as unknown[]);
        console.log('[BOOT][useCatalog] cache payload diagnostics', {
          categories: cached.categories.length,
          products: cached.products.length,
          invalidProductShapeCount: invalidCachedProducts.length,
          cacheAgeMs: cachedEntry ? Math.max(0, now - cachedEntry.cachedAt) : null,
          stamp: cachedEntry?.stamp ?? null,
        });
        if (invalidCachedProducts.length > 0) {
          const sample = invalidCachedProducts.slice(0, 3);
          console.error('[BOOT][useCatalog] cache contains products with unexpected shape', {
            sample,
          });
        }

        if (cached.categories.length) {
          setCategories(cached.categories);
          setSelectedCategoryId((prev) => prev || cached.categories[0]?.id || '');
        }

        if (cached.products.length) {
          setProducts(cached.products);
          setSelectedProductId((prev) => prev || cached.products[0]?.id || '');
        }

        setCatalogMeta(`Catalog cache: ${cached.products.length} produse afișate instant.`);
        setCatalogLoading(false);
      }

      try {
        const lastCheckedAt = cachedEntry?.lastCheckedAt ?? 0;
        const timeSinceLastCheckMs = lastCheckedAt
          ? Math.max(0, now - lastCheckedAt)
          : Number.POSITIVE_INFINITY;
        const hasCheckedToday = timeSinceLastCheckMs <= CATALOG_CACHE_MAX_AGE_MS;

        let stampPayload: { stamp: string } | null = null;
        try {
          stampPayload = await loadCatalogStamp();
        } catch {
          console.warn('[BOOT][useCatalog] stamp fetch failed, using fallback logic');
        }

        const stampMatchesCache =
          !!cachedEntry &&
          typeof cachedEntry.stamp === 'string' &&
          cachedEntry.stamp.length > 0 &&
          stampPayload?.stamp === cachedEntry.stamp;
        const canSkipRefresh =
          !!cachedEntry && hasCheckedToday && (stampMatchesCache || !stampPayload);

        if (canSkipRefresh) {
          if (cached) {
            const freshnessHours = Math.max(1, Math.round(timeSinceLastCheckMs / 3600000));
            setCatalogMeta(
              stampMatchesCache
                ? `Catalog actualizat azi (${cached.products.length} produse).`
                : `Catalog din cache (${cached.products.length} produse). Următorul update mâine la 2 AM.`,
            );

            if (cached.hasMoreProducts && cached.productsCursor) {
              void loadRemainingCatalogPages({
                startCursor: cached.productsCursor,
                seedProducts: cached.products,
                seedCategories: cached.categories,
                stamp: cachedEntry?.stamp ?? null,
              });
            }
          }
          setCatalogError(null);
          return;
        }

        const live = await loadLiveCatalog({
          pageSize: INITIAL_PAGE_SIZE,
          leanQuery: true,
          includeCategories: true,
        });
        if (!active) return;

        const invalidLiveProducts = collectInvalidProductShape(live.products as unknown[]);
        console.log('[BOOT][useCatalog] live payload diagnostics', {
          categories: live.categories.length,
          products: live.products.length,
          hasMoreProducts: live.hasMoreProducts,
          productsCursor: live.productsCursor,
          invalidProductShapeCount: invalidLiveProducts.length,
        });
        if (invalidLiveProducts.length > 0) {
          const sample = invalidLiveProducts.slice(0, 3);
          console.error('[BOOT][useCatalog] live catalog contains products with unexpected shape', {
            sample,
          });
        }

        if (live.categories.length) {
          setCategories(live.categories);
          setSelectedCategoryId((prev) => prev || live.categories[0]?.id || '');
        }

        if (live.products.length) {
          setProducts(live.products);
          setSelectedProductId((prev) => prev || live.products[0]?.id || '');
        }

        await writeCatalogCache(live, { stamp: stampPayload?.stamp ?? null });

        setCatalogMeta(
          live.hasMoreProducts
            ? `Catalog live: ${live.products.length} produse încărcate inițial (restul în fundal).`
            : `Catalog live: ${live.products.length} produse încărcate.`,
        );

        if (live.hasMoreProducts && live.productsCursor) {
          void loadRemainingCatalogPages({
            startCursor: live.productsCursor,
            seedProducts: live.products,
            seedCategories: live.categories,
            stamp: stampPayload?.stamp ?? null,
          });
        }

        setCatalogError(null);
      } catch (error) {
        if (!active) return;
        console.error('[BOOT][useCatalog] hydrateCatalog failed', {
          error,
        });
        setCatalogError('Nu s-a putut încărca catalogul live momentan.');
        setCatalogMeta(
          cached && cached.products.length > 0
            ? `Catalog cache activ (${cached.products.length} produse). Reîmprospătarea live a eșuat.`
            : 'Catalog live indisponibil momentan. Reîncearcă în câteva momente.',
        );
      } finally {
        if (active) setCatalogLoading(false);
      }
    };

    hydrateCatalog();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((item) => item.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0]?.id ?? '');
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (products.length > 0 && !products.some((item) => item.id === selectedProductId)) {
      setSelectedProductId(products[0]?.id ?? '');
    }
  }, [products, selectedProductId]);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId],
  );

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === selectedProductId) ?? products[0],
    [products, selectedProductId],
  );

  const { productsById, countByCategory } = useMemo(
    () => buildProductIndexes(products),
    [products],
  );

  return {
    categories,
    products,
    selectedCategoryId,
    selectedProductId,
    catalogLoading,
    catalogError,
    catalogMeta,
    setCatalogError,
    setCatalogMeta,
    upsertProducts,
    setSelectedCategoryId,
    setSelectedProductId,
    selectedCategory,
    selectedProduct,
    productsById,
    countByCategory,
  };
};
