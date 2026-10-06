import rawBootstrap from './catalogBootstrap.json';
import type { CatalogCategory } from './catalog';

export type BundledCatalogBootstrap = {
  stamp?: string | null;
  generatedAt?: string;
  categories: CatalogCategory[];
};

export const bundledCatalogBootstrap = rawBootstrap as BundledCatalogBootstrap;
