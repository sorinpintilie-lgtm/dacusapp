import rawBootstrap from './catalogBootstrap.json';
import type { CatalogCategory, CatalogProduct } from './catalog';

export type BundledCatalogBootstrap = {
  source?: string;
  stamp?: string | null;
  generatedAt?: string;
  categories: CatalogCategory[];
  products: CatalogProduct[];
  hasMoreProducts: boolean;
  productsCursor: string | null;
};

export const bundledCatalogBootstrap = rawBootstrap as BundledCatalogBootstrap;
