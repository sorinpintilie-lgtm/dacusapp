import type { PriceFilterOption, SortOption } from '../utils/catalogFilters';

export type ProductListFilters = {
  brandFilter: string;
  priceFilter: PriceFilterOption;
  onlyDiscount: boolean;
  onlyInStock: boolean;
  onlyFavorites: boolean;
  sortOption: SortOption;
};

export const DEFAULT_PRODUCT_FILTERS: ProductListFilters = {
  brandFilter: 'toate',
  priceFilter: 'toate',
  onlyDiscount: false,
  onlyInStock: true,
  onlyFavorites: false,
  sortOption: 'relevanta',
};

export const SORT_LABELS: Record<SortOption, string> = {
  relevanta: 'Relevanță',
  pretCrescator: 'Preț crescător',
  pretDescrescator: 'Preț descrescător',
  numeAZ: 'Nume A-Z',
};

export const PRICE_LABELS: Record<PriceFilterOption, string> = {
  toate: 'Orice preț',
  sub200: 'Sub 200 RON',
  intre200si500: '200 - 500 RON',
  intre500si1000: '500 - 1.000 RON',
  peste1000: 'Peste 1.000 RON',
};

/** Search results include sold-out products (ranked last), so a search never looks empty by accident. */
export const SEARCH_DEFAULT_FILTERS: ProductListFilters = { ...DEFAULT_PRODUCT_FILTERS, onlyInStock: false };

/** How many filters differ from the defaults (sorting not included). */
export const countActiveFilters = (filters: ProductListFilters, baseline = DEFAULT_PRODUCT_FILTERS) =>
  Number(filters.brandFilter !== baseline.brandFilter) +
  Number(filters.priceFilter !== baseline.priceFilter) +
  Number(filters.onlyDiscount !== baseline.onlyDiscount) +
  Number(filters.onlyInStock !== baseline.onlyInStock) +
  Number(filters.onlyFavorites !== baseline.onlyFavorites);

export const describeFilters = (filters: ProductListFilters, baseline = DEFAULT_PRODUCT_FILTERS) => {
  const parts: string[] = [];
  if (filters.brandFilter !== 'toate') parts.push(filters.brandFilter);
  if (filters.priceFilter !== 'toate') parts.push(PRICE_LABELS[filters.priceFilter]);
  if (filters.onlyDiscount) parts.push('Reduceri');
  if (filters.onlyInStock !== baseline.onlyInStock) parts.push(filters.onlyInStock ? 'Doar în stoc' : 'Include stoc epuizat');
  if (filters.onlyFavorites) parts.push('Favorite');
  if (filters.sortOption !== 'relevanta') parts.push(SORT_LABELS[filters.sortOption]);
  return parts.join(', ');
};
