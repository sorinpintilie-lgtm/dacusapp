import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CatalogCategory, CatalogProduct } from '../data/catalog';
import { bundledCatalogBootstrap } from '../data/catalogBootstrap';
import { loadBundledCategoryProducts } from '../data/catalogChunkIndex';
import type { LiveCatalogPayload } from '../services/storefront';
import { buildProductIndexes } from '../utils/catalogFilters';

const BUNDLED_CATEGORIES = bundledCatalogBootstrap.categories ?? [];
const BUNDLED_PRODUCTS = bundledCatalogBootstrap.products ?? [];

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
  refreshCatalog: () => void;
  ensureCategoryProductsLoaded: (categoryId: string) => Promise<void>;
};

const mergeProductsById = (base: CatalogProduct[], incoming: CatalogProduct[]) => {
  const merged = new Map(base.map((item) => [item.id, item]));
  incoming.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
};

export const useCatalog = (): CatalogState => {
  const [categories, setCategories] = useState<CatalogCategory[]>(BUNDLED_CATEGORIES);
  const [products, setProducts] = useState<CatalogProduct[]>(BUNDLED_PRODUCTS);
  const [selectedCategoryId, setSelectedCategoryId] = useState(BUNDLED_CATEGORIES[0]?.id ?? '');
  const [selectedProductId, setSelectedProductId] = useState(BUNDLED_PRODUCTS[0]?.id ?? '');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogMeta, setCatalogMeta] = useState(
    BUNDLED_PRODUCTS.length > 0
      ? `Catalog local: ${BUNDLED_PRODUCTS.length} produse pregătite.`
      : 'Catalog local: se pregătește...'
  );
  const loadedCategoryIdsRef = useRef(
    new Set(
      BUNDLED_PRODUCTS.flatMap((product) =>
        Array.isArray(product.categoryIds) && product.categoryIds.length > 0
          ? product.categoryIds
          : [product.categoryId],
      ).filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  );

  const upsertProducts = useCallback((items: CatalogProduct[]) => {
    if (!Array.isArray(items) || items.length === 0) return;
    setProducts((prev) => {
      const merged = new Map(prev.map((item) => [item.id, item]));
      items.forEach((item) => merged.set(item.id, item));
      return Array.from(merged.values());
    });
  }, []);

  const refreshCatalog = useCallback(() => {
    // Manual no-op for the fully local mode used to isolate UI performance.
  }, []);

  const ensureCategoryProductsLoaded = useCallback(async (categoryId: string) => {
    if (!categoryId || loadedCategoryIdsRef.current.has(categoryId)) return;

    const chunkProducts = loadBundledCategoryProducts(categoryId);
    if (chunkProducts.length === 0) {
      loadedCategoryIdsRef.current.add(categoryId);
      return;
    }

    loadedCategoryIdsRef.current.add(categoryId);
    setProducts((prev) => mergeProductsById(prev, chunkProducts));
  }, []);

  useEffect(() => {
    setCatalogLoading(false);
    setCatalogError(null);
    setCatalogMeta(
      BUNDLED_PRODUCTS.length > 0
        ? `Catalog local: ${BUNDLED_PRODUCTS.length} produse de start pregătite.`
        : 'Catalog local: pregătit fără produse bootstrap.',
    );
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
    refreshCatalog,
    ensureCategoryProductsLoaded,
  };
};
