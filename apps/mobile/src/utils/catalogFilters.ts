import type { CatalogProduct } from '../data/catalog';

export type SortOption = 'relevanta' | 'pretCrescator' | 'pretDescrescator' | 'numeAZ';
export type PriceFilterOption = 'toate' | 'sub200' | 'intre200si500' | 'intre500si1000' | 'peste1000';

export type FilterOptions = {
  query: string;
  brandFilter: string;
  priceFilter: PriceFilterOption;
  onlyDiscount: boolean;
  onlyInStock: boolean;
  sortOption: SortOption;
};

export const formatPrice = (value: number | undefined) => `${Math.round(value ?? 0).toLocaleString('ro-RO')} RON`;

export const isLikelyInStock = (label: string) => {
  const normalized = label.toLowerCase();
  return normalized.includes('stoc') || normalized.includes('disponibil');
};

export const matchesPriceFilter = (price: number, option: PriceFilterOption) => {
  if (option === 'sub200') return price < 200;
  if (option === 'intre200si500') return price >= 200 && price <= 500;
  if (option === 'intre500si1000') return price > 500 && price <= 1000;
  if (option === 'peste1000') return price > 1000;
  return true;
};

export const sortProducts = (items: CatalogProduct[], option: SortOption) => {
  if (option === 'pretCrescator') return [...items].sort((a, b) => a.priceRon - b.priceRon);
  if (option === 'pretDescrescator') return [...items].sort((a, b) => b.priceRon - a.priceRon);
  if (option === 'numeAZ') return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  return items;
};

export const getProductSearchHaystack = (product: CatalogProduct) =>
  `${product.name} ${product.brand} ${product.description ?? ''} ${product.handle ?? ''} ${product.sku ?? ''} ${product.id}`.toLowerCase();

export const filterProducts = (source: CatalogProduct[], options: FilterOptions): CatalogProduct[] => {
  const q = options.query.trim().toLowerCase();

  const filtered = source.filter((item) => {
    const queryMatch = !q || getProductSearchHaystack(item).includes(q);
    const brandMatch = options.brandFilter === 'toate' || item.brand === options.brandFilter;
    const priceMatch = matchesPriceFilter(item.priceRon, options.priceFilter);
    const discountMatch = !options.onlyDiscount || (item.oldPriceRon ?? 0) > item.priceRon;
    const stockMatch = !options.onlyInStock || isLikelyInStock(item.stockLabel);

    return queryMatch && brandMatch && priceMatch && discountMatch && stockMatch;
  });

  return sortProducts(filtered, options.sortOption);
};

export const buildProductIndexes = (products: CatalogProduct[]) => {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const countByCategory = new Map<string, number>();

  products.forEach((product) => {
    countByCategory.set(product.categoryId, (countByCategory.get(product.categoryId) ?? 0) + 1);
  });

  return { productsById, countByCategory };
};
