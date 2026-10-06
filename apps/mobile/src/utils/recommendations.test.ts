import { describe, expect, it } from 'vitest';

import type { CatalogProduct } from '../data/catalog';
import { getBundleProducts, getSimilarProducts, getUpsellProducts, takeSmallest } from './recommendations';

const product = (id: string, overrides: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id,
  categoryId: 'c-1',
  name: `Produs ${id}`,
  brand: 'Dacus',
  priceRon: 100,
  stockLabel: 'În stoc',
  ...overrides,
});

describe('takeSmallest', () => {
  it('matches sorting then slicing, keeping input order on ties', () => {
    const values = [5, 3, 9, 3, 1, 7, 3, 8, 2, 6];
    const indexed = values.map((value, index) => ({ value, index }));
    const expected = [...indexed].sort((a, b) => a.value - b.value).slice(0, 4);

    expect(takeSmallest(indexed, 4, (a, b) => a.value - b.value)).toEqual(expected);
  });

  it('returns everything when there are fewer items than requested', () => {
    expect(takeSmallest([3, 1, 2], 10, (a, b) => a - b)).toEqual([1, 2, 3]);
  });
});

describe('recommendations', () => {
  const current = product('p-0', { priceRon: 100 });
  const catalog = [
    current,
    product('near', { priceRon: 105 }),
    product('far', { priceRon: 300 }),
    product('discounted', { priceRon: 250, oldPriceRon: 400 }),
    product('other-category', { categoryId: 'c-2', priceRon: 120 }),
    product('other-brand', { categoryId: 'c-2', brand: 'Bosch', priceRon: 90, oldPriceRon: 150 }),
    product('cheaper-other-category', { categoryId: 'c-3', priceRon: 50 }),
  ];

  it('lists same-category products, discounted first, then by price distance', () => {
    expect(getSimilarProducts(current, catalog).map((item) => item.id)).toEqual(['discounted', 'near', 'far']);
  });

  it('suggests pricier same-brand products elsewhere, then discounts', () => {
    expect(getUpsellProducts(current, catalog, new Set()).map((item) => item.id)).toEqual(['other-category', 'other-brand']);
  });

  it('bundles same-brand products from other categories in catalog order', () => {
    expect(getBundleProducts(current, catalog).map((item) => item.id)).toEqual(['other-category', 'cheaper-other-category']);
  });
});
