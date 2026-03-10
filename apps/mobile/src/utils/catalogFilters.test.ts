import { describe, expect, it } from 'vitest';

import type { CatalogProduct } from '../data/catalog';
import { buildProductIndexes, filterProducts, formatPrice } from './catalogFilters';

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
  it('formats prices for RO locale', () => {
    expect(formatPrice(1234)).toBe('1.234 RON');
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

  it('builds category and product indexes', () => {
    const { productsById, countByCategory } = buildProductIndexes(sampleProducts);

    expect(productsById.get('p-2')?.brand).toBe('Bosch');
    expect(countByCategory.get('c-1')).toBe(2);
    expect(countByCategory.get('c-2')).toBe(1);
  });
});
