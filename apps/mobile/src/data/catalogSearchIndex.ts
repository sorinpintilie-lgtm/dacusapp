import type { CatalogProduct } from './catalog';

export type LocalSearchCatalogProduct = Pick<
  CatalogProduct,
  | 'id'
  | 'categoryId'
  | 'categoryIds'
  | 'name'
  | 'brand'
  | 'sku'
  | 'handle'
  | 'thumbnailUrl'
  | 'imageUrl'
  | 'priceRon'
  | 'oldPriceRon'
  | 'stockLabel'
  | 'variantId'
  | 'description'
>;

let cachedSearchIndex: LocalSearchCatalogProduct[] | null = null;

export const loadBundledSearchIndex = (): LocalSearchCatalogProduct[] => {
  if (cachedSearchIndex) return cachedSearchIndex;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cachedSearchIndex = require('./catalogSearchIndex.json') as LocalSearchCatalogProduct[];
  return cachedSearchIndex;
};
