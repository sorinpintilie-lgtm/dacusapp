import rawSnapshot from './catalogSnapshot.json';
import type { CatalogCategory, CatalogProduct } from './catalog';

export type BundledCatalogSnapshot = {
  source?: string;
  stamp?: string | null;
  generatedAt?: string;
  categories: CatalogCategory[];
  products: CatalogProduct[];
  hasMoreProducts: boolean;
  productsCursor: string | null;
};

export const bundledCatalogSnapshot = rawSnapshot as BundledCatalogSnapshot;
