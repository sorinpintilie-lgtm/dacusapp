import { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';

import { mobileEnv } from '../config/env';
import type { CatalogCategory, CatalogProduct } from '../data/catalog';
import { bundledCatalogBootstrap } from '../data/catalogBootstrap';
import { bundledCatalogProducts } from '../data/catalogProducts';
import { createStorefrontClient, fetchProducts } from '../data/shopifyCatalog';
import { buildProductIndexes } from '../utils/catalogFilters';

const BUNDLED_CATEGORIES = bundledCatalogBootstrap.categories ?? [];
const BUNDLED_PRODUCTS = bundledCatalogProducts;

// Products changed in Shopify after the bundled catalog was built (prices, stock, photos) are fetched once
// the first screen is up. Capped so a very old bundle doesn't turn startup into a full download.
const UPDATE_MAX_PAGES = 8;

const fetchUpdatedProducts = async () => {
  const since = bundledCatalogBootstrap.generatedAt;
  if (!since || !mobileEnv.shopifyStoreDomain || !mobileEnv.storefrontPublicToken) return [];
  const query = createStorefrontClient(
    mobileEnv.shopifyStoreDomain,
    mobileEnv.storefrontPublicToken,
  );
  const knownCategoryIds = new Set(BUNDLED_CATEGORIES.map((category) => category.id));
  return fetchProducts(query, knownCategoryIds, {
    updatedSince: since,
    maxPages: UPDATE_MAX_PAGES,
  });
};

type CatalogState = {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  productsById: Map<string, CatalogProduct>;
  countByCategory: Map<string, number>;
  /** Products of each category (every membership, in catalog order). */
  productsByCategory: Map<string, CatalogProduct[]>;
  upsertProducts: (items: CatalogProduct[]) => void;
};

export const useCatalog = (): CatalogState => {
  const [categories] = useState<CatalogCategory[]>(BUNDLED_CATEGORIES);
  const [products, setProducts] = useState<CatalogProduct[]>(BUNDLED_PRODUCTS);

  const upsertProducts = useCallback((items: CatalogProduct[]) => {
    if (!Array.isArray(items) || items.length === 0) return;
    setProducts((prev) => {
      const merged = new Map(prev.map((item) => [item.id, item]));
      items.forEach((item) => merged.set(item.id, item));
      return Array.from(merged.values());
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      fetchUpdatedProducts()
        .then((updated) => {
          if (!cancelled) upsertProducts(updated);
        })
        // Offline or Shopify unavailable: the bundled catalog stays in use.
        .catch((error: unknown) =>
          console.warn('[catalog] update skipped', error instanceof Error ? error.message : error),
        );
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [upsertProducts]);

  const { productsById, countByCategory } = useMemo(
    () => buildProductIndexes(products),
    [products],
  );

  const productsByCategory = useMemo(() => {
    const map = new Map<string, CatalogProduct[]>();
    for (const product of products) {
      const membership =
        Array.isArray(product.categoryIds) && product.categoryIds.length > 0
          ? product.categoryIds
          : [product.categoryId];
      for (const categoryId of membership) {
        if (!categoryId) continue;
        const bucket = map.get(categoryId);
        if (bucket) bucket.push(product);
        else map.set(categoryId, [product]);
      }
    }
    return map;
  }, [products]);

  return {
    categories,
    products,
    productsById,
    countByCategory,
    productsByCategory,
    upsertProducts,
  };
};
