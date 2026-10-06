import { useCallback, useMemo, useState } from 'react';

import type { CatalogCategory, CatalogProduct } from '../data/catalog';
import { bundledCatalogBootstrap } from '../data/catalogBootstrap';
import { bundledCatalogProducts } from '../data/catalogProducts';
import { buildProductIndexes } from '../utils/catalogFilters';

const BUNDLED_CATEGORIES = bundledCatalogBootstrap.categories ?? [];
const BUNDLED_PRODUCTS = bundledCatalogProducts;

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

  const { productsById, countByCategory } = useMemo(() => buildProductIndexes(products), [products]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, CatalogProduct[]>();
    for (const product of products) {
      const membership =
        Array.isArray(product.categoryIds) && product.categoryIds.length > 0 ? product.categoryIds : [product.categoryId];
      for (const categoryId of membership) {
        if (!categoryId) continue;
        const bucket = map.get(categoryId);
        if (bucket) bucket.push(product);
        else map.set(categoryId, [product]);
      }
    }
    return map;
  }, [products]);

  return { categories, products, productsById, countByCategory, productsByCategory, upsertProducts };
};
