import { describe, expect, it } from 'vitest';

import type { CatalogProduct } from '../data/catalog';
import {
  buildProductIndexes,
  filterProducts,
  formatPrice,
  isLikelyInStock,
  isProductInStock,
} from './catalogFilters';

const sampleProducts: CatalogProduct[] = [
  {
    id: 'p-1',
    categoryId: 'c-1',
    name: 'Polizor unghiular',
    brand: 'Makita',
    description: 'Model puternic pentru atelier',
    priceRon: 450,
    oldPriceRon: 500,
    stockLabel: 'În stoc',
  },
  {
    id: 'p-2',
    categoryId: 'c-1',
    name: 'Bormașină compactă',
    brand: 'Bosch',
    description: 'Ușoară și precisă',
    priceRon: 199,
    stockLabel: 'Disponibil',
  },
  {
    id: 'p-3',
    categoryId: 'c-2',
    name: 'Compresor aer 50L',
    brand: 'Dacus',
    description: 'Pentru aplicații profesionale',
    priceRon: 1099,
    stockLabel: 'Precomandă',
  },
];

describe('catalogFilters', () => {
  it('formats prices for RO locale while preserving decimals', () => {
    expect(formatPrice(1234)).toBe('1.234,00 RON');
    expect(formatPrice(1234.5)).toBe('1.234,50 RON');
    expect(formatPrice(1234.56)).toBe('1.234,56 RON');
  });

  it('filters by brand, discount and stock', () => {
    const filtered = filterProducts(sampleProducts, {
      query: '',
      brandFilter: 'Makita',
      priceFilter: 'toate',
      onlyDiscount: true,
      onlyInStock: true,
      sortOption: 'relevanta',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('p-1');
  });

  it('searches and sorts descending by price', () => {
    const filtered = filterProducts(sampleProducts, {
      query: 'or',
      brandFilter: 'toate',
      priceFilter: 'toate',
      onlyDiscount: false,
      onlyInStock: false,
      sortOption: 'pretDescrescator',
    });

    expect(filtered.map((item) => item.id)).toEqual(['p-3', 'p-1', 'p-2']);
  });

  it('handles stock labels robustly and rejects pre-order/out-of-stock labels', () => {
    expect(isLikelyInStock('În stoc')).toBe(true);
    expect(isLikelyInStock('Disponibil')).toBe(true);
    expect(isLikelyInStock('Precomandă')).toBe(false);
    expect(isLikelyInStock('Indisponibil')).toBe(false);
    expect(isLikelyInStock('Nu este în stoc')).toBe(false);

    const withVariants: CatalogProduct = {
      id: 'p-v',
      categoryId: 'c-3',
      name: 'Set biți',
      brand: 'Dacus',
      priceRon: 89,
      stockLabel: 'Indisponibil',
      variants: [
        { id: 'v-1', name: 'Set 10', priceRon: 89, inStock: false },
        { id: 'v-2', name: 'Set 20', priceRon: 129, inStock: true },
      ],
    };

    expect(isProductInStock(withVariants)).toBe(true);
  });

  it('matches search accent-insensitively and with multiple tokens', () => {
    const filtered = filterProducts(sampleProducts, {
      query: 'bormasina compacta',
      brandFilter: 'toate',
      priceFilter: 'toate',
      onlyDiscount: false,
      onlyInStock: false,
      sortOption: 'relevanta',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('p-2');
  });

  it('sorts by relevance when query is present', () => {
    const relevanceProducts: CatalogProduct[] = [
      {
        id: 'r-1',
        categoryId: 'c-1',
        name: 'Bosch Pro Drill',
        brand: 'Bosch',
        priceRon: 699,
        stockLabel: 'În stoc',
      },
      {
        id: 'r-2',
        categoryId: 'c-1',
        name: 'Drill stand universal',
        brand: 'Dacus',
        priceRon: 299,
        stockLabel: 'În stoc',
      },
      {
        id: 'r-3',
        categoryId: 'c-1',
        name: 'Accesoriu electric',
        brand: 'DrillMaster',
        priceRon: 99,
        stockLabel: 'În stoc',
      },
    ];

    const filtered = filterProducts(relevanceProducts, {
      query: 'drill',
      brandFilter: 'toate',
      priceFilter: 'toate',
      onlyDiscount: false,
      onlyInStock: false,
      sortOption: 'relevanta',
    });

    expect(filtered.map((item) => item.id)).toEqual(['r-2', 'r-1', 'r-3']);
  });

  it('builds category and product indexes', () => {
    const { productsById, countByCategory } = buildProductIndexes(sampleProducts);

    expect(productsById.get('p-2')?.brand).toBe('Bosch');
    expect(countByCategory.get('c-1')).toBe(2);
    expect(countByCategory.get('c-2')).toBe(1);
  });

  it('counts products for every subcollection membership when categoryIds are present', () => {
    const multiCategoryProducts: CatalogProduct[] = [
      {
        id: 'mc-1',
        categoryId: 'root',
        categoryIds: ['root', 'root/sub-a', 'root/sub-b'],
        name: 'Test subcollection item',
        brand: 'Dacus',
        priceRon: 150,
        stockLabel: 'În stoc',
      },
    ];

    const { countByCategory } = buildProductIndexes(multiCategoryProducts);

    expect(countByCategory.get('root')).toBe(1);
    expect(countByCategory.get('root/sub-a')).toBe(1);
    expect(countByCategory.get('root/sub-b')).toBe(1);
  });

  it('counts a product once per category even when the category is listed twice', () => {
    const { countByCategory } = buildProductIndexes([
      {
        id: 'dup-1',
        categoryId: 'c-1',
        categoryIds: ['c-1', 'c-2', 'c-1', ''],
        name: 'Duplicate membership',
        brand: 'Dacus',
        priceRon: 10,
        stockLabel: 'În stoc',
      },
    ]);

    expect(countByCategory.get('c-1')).toBe(1);
    expect(countByCategory.get('c-2')).toBe(1);
    expect(countByCategory.has('')).toBe(false);
  });

  it('returns the same search results when the cached search text is reused', () => {
    const options = {
      query: 'bormasina',
      brandFilter: 'toate',
      priceFilter: 'toate' as const,
      onlyDiscount: false,
      onlyInStock: false,
      sortOption: 'relevanta' as const,
    };

    const first = filterProducts(sampleProducts, options);
    const second = filterProducts(sampleProducts, options);

    expect(first.map((item) => item.id)).toEqual(['p-2']);
    expect(second.map((item) => item.id)).toEqual(['p-2']);
  });
});
