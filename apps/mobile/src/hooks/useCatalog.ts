import { useEffect, useMemo, useState } from 'react';

import type { CatalogCategory, CatalogProduct } from '../data/catalog';
import { readCatalogCache, writeCatalogCache } from '../services/catalogCache';
import { loadLiveCatalog, streamLiveCatalogProductsAfterCursor } from '../services/storefront';
import { buildProductIndexes } from '../utils/catalogFilters';

type CatalogState = {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  selectedCategoryId: string;
  selectedProductId: string;
  catalogLoading: boolean;
  catalogError: string | null;
  catalogMeta: string;
  setSelectedCategoryId: (value: string) => void;
  setSelectedProductId: (value: string) => void;
  selectedCategory?: CatalogCategory;
  selectedProduct?: CatalogProduct;
  countByCategory: Map<string, number>;
  productsById: Map<string, CatalogProduct>;
};

export const useCatalog = (): CatalogState => {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogMeta, setCatalogMeta] = useState('Catalog live: se încarcă...');

  useEffect(() => {
    let active = true;

    const hydrateCatalog = async () => {
      const cached = await readCatalogCache();

      if (active && cached) {
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
        const live = await loadLiveCatalog({ pageSize: 60, leanQuery: true, includeCategories: true });
        if (!active) return;

        if (live.categories.length) {
          setCategories(live.categories);
          setSelectedCategoryId((prev) => prev || live.categories[0]?.id || '');
        }

        if (live.products.length) {
          setProducts(live.products);
          setSelectedProductId((prev) => prev || live.products[0]?.id || '');
        }

        await writeCatalogCache(live);

        if (live.hasMoreProducts && live.productsCursor && live.categories.length > 0) {
          setCatalogMeta(`Catalog live: încărcare inițială ${live.products.length} produse, continuă în fundal...`);

          streamLiveCatalogProductsAfterCursor(
            live.productsCursor,
            (pageProducts, loadedTotal) => {
              if (!active || pageProducts.length === 0) return;
              setProducts((prev) => {
                const merged = new Map(prev.map((item) => [item.id, item]));
                pageProducts.forEach((item) => merged.set(item.id, item));
                return Array.from(merged.values());
              });
              setCatalogMeta(`Catalog live: ${live.products.length + loadedTotal} produse încărcate...`);
            },
            { pageSize: 80, leanQuery: true },
          )
            .then((loadedTotal) => {
              if (!active) return;
              setCatalogMeta(`Catalog live: ${live.products.length + loadedTotal} produse încărcate complet.`);
              setProducts((currentProducts) => {
                const fullPayload = {
                  ...live,
                  products: currentProducts,
                  hasMoreProducts: false,
                  productsCursor: null,
                };
                void writeCatalogCache(fullPayload);
                return currentProducts;
              });
            })
            .catch(() => {
              if (!active) return;
              setCatalogMeta('Catalog live: încărcare parțială finalizată (fundal întrerupt).');
            });
        } else {
          setCatalogMeta(`Catalog live: ${live.products.length} produse încărcate.`);
        }

        setCatalogError(null);
      } catch {
        if (!active) return;
        setCatalogError('Nu s-a putut încărca catalogul live momentan.');
        setCatalogMeta('Catalog live indisponibil momentan.');
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

  const { productsById, countByCategory } = useMemo(() => buildProductIndexes(products), [products]);

  return {
    categories,
    products,
    selectedCategoryId,
    selectedProductId,
    catalogLoading,
    catalogError,
    catalogMeta,
    setSelectedCategoryId,
    setSelectedProductId,
    selectedCategory,
    selectedProduct,
    productsById,
    countByCategory,
  };
};
