export type CatalogCategory = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
};

export type CatalogProduct = {
  id: string;
  categoryId: string;
  handle?: string;
  sku?: string;
  name: string;
  brand: string;
  description?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  priceRon: number;
  oldPriceRon?: number;
  stockLabel: string;
};

export const loyaltySummary = {
  points: 1240,
  tier: 'Silver',
  nextTierSpendRon: 260,
};

