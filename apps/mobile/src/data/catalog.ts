export type CatalogCategory = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
};

export type CatalogProduct = {
  id: string;
  categoryId: string;
  categoryIds?: string[];
  handle?: string;
  sku?: string;
  variantId?: string;
  name: string;
  brand: string;
  description?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  priceRon: number;
  oldPriceRon?: number;
  stockLabel: string;
  variants?: Array<{
    id: string;
    name: string;
    priceRon: number;
    inStock: boolean;
  }>;
};

