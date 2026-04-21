import type { CatalogProduct } from '../data/catalog';

export type SortOption = 'relevanta' | 'pretCrescator' | 'pretDescrescator' | 'numeAZ';
export type PriceFilterOption = 'toate' | 'sub200' | 'intre200si500' | 'intre500si1000' | 'peste1000';
export type StockBadgeTone = 'inStock' | 'limited' | 'outOfStock';

export type FilterOptions = {
  query: string;
  brandFilter: string;
  priceFilter: PriceFilterOption;
  onlyDiscount: boolean;
  onlyInStock: boolean;
  sortOption: SortOption;
};

const parsePriceValue = (value: number | string | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;

  const compact = value.trim().replace(/\s+/g, '');
  if (!compact) return 0;

  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');

  const normalized =
    lastComma > lastDot
      ? compact.replace(/\./g, '').replace(',', '.')
      : lastDot > lastComma
        ? compact.replace(/,/g, '')
        : compact.replace(',', '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatPrice = (value: number | string | undefined) => {
  const amount = parsePriceValue(value);
  return `${amount.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON`;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const hasAnyKeyword = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

const LIMITED_STOCK_KEYWORDS = ['stoc limitat', 'ultimele bucati', 'stoc redus', 'limited'];
const OUT_OF_STOCK_KEYWORDS = [
  'indisponibil',
  'fara stoc',
  'stoc epuizat',
  'stoc indisponibil',
  'out of stock',
  'precomanda',
];
const IN_STOCK_KEYWORDS = ['in stoc', 'stoc disponibil', 'disponibil', 'available'];

export const getStockBadgeTone = (label: string | null | undefined): StockBadgeTone => {
  if (typeof label !== 'string') return 'outOfStock';

  const normalized = normalizeText(label);

  if (hasAnyKeyword(normalized, OUT_OF_STOCK_KEYWORDS)) return 'outOfStock';
  if (hasAnyKeyword(normalized, LIMITED_STOCK_KEYWORDS)) return 'limited';
  if (hasAnyKeyword(normalized, IN_STOCK_KEYWORDS)) return 'inStock';

  return 'outOfStock';
};

export const isLikelyInStock = (label: string | null | undefined) => {
  const tone = getStockBadgeTone(label);
  return tone === 'inStock' || tone === 'limited';
};

export const isProductInStock = (product: CatalogProduct) => {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.some((variant) => variant.inStock);
  }

  return isLikelyInStock(product.stockLabel);
};

export const matchesPriceFilter = (price: number, option: PriceFilterOption) => {
  if (!Number.isFinite(price)) return false;
  if (option === 'sub200') return price < 200;
  if (option === 'intre200si500') return price >= 200 && price <= 500;
  if (option === 'intre500si1000') return price > 500 && price <= 1000;
  if (option === 'peste1000') return price > 1000;
  return true;
};

const computeRelevanceScore = (product: CatalogProduct, normalizedQuery: string) => {
  if (!normalizedQuery) return 0;

  const normalizedName = normalizeText(product.name);
  const normalizedBrand = normalizeText(product.brand);
  const normalizedSku = normalizeText(product.sku ?? '');
  const normalizedHandle = normalizeText(product.handle ?? '');
  const normalizedDescription = normalizeText(product.description ?? '');

  if (normalizedName === normalizedQuery) return 100;
  if (normalizedName.startsWith(normalizedQuery)) return 90;
  if (normalizedName.includes(normalizedQuery)) return 80;
  if (normalizedBrand.startsWith(normalizedQuery)) return 70;
  if (normalizedBrand.includes(normalizedQuery)) return 60;
  if (normalizedSku.includes(normalizedQuery) || normalizedHandle.includes(normalizedQuery)) return 50;
  if (normalizedDescription.includes(normalizedQuery)) return 40;
  return 0;
};

export const sortProducts = (items: CatalogProduct[], option: SortOption, query = '') => {
  if (option === 'pretCrescator') return [...items].sort((a, b) => a.priceRon - b.priceRon);
  if (option === 'pretDescrescator') return [...items].sort((a, b) => b.priceRon - a.priceRon);
  if (option === 'numeAZ') return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ro'));

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return items;

  return [...items].sort((a, b) => {
    const scoreDiff = computeRelevanceScore(b, normalizedQuery) - computeRelevanceScore(a, normalizedQuery);
    if (scoreDiff !== 0) return scoreDiff;

    const discountDiff = Number((b.oldPriceRon ?? 0) > b.priceRon) - Number((a.oldPriceRon ?? 0) > a.priceRon);
    if (discountDiff !== 0) return discountDiff;

    return a.name.localeCompare(b.name, 'ro');
  });
};

export const getProductSearchHaystack = (product: CatalogProduct) =>
  normalizeText(
    `${product.name} ${product.brand} ${product.description ?? ''} ${product.handle ?? ''} ${product.sku ?? ''} ${product.id}`,
  );

export const filterProducts = (source: CatalogProduct[], options: FilterOptions): CatalogProduct[] => {
  const q = normalizeText(options.query);
  const queryTokens = q.length > 0 ? q.split(' ').filter((token) => token.length > 0) : [];

  const filtered = source.filter((item) => {
    const haystack = getProductSearchHaystack(item);
    const queryMatch = queryTokens.length === 0 || queryTokens.every((token) => haystack.includes(token));
    const brandMatch = options.brandFilter === 'toate' || normalizeText(item.brand) === normalizeText(options.brandFilter);
    const priceMatch = matchesPriceFilter(item.priceRon, options.priceFilter);
    const discountMatch = !options.onlyDiscount || (item.oldPriceRon ?? 0) > item.priceRon;
    const stockMatch = !options.onlyInStock || isProductInStock(item);

    return queryMatch && brandMatch && priceMatch && discountMatch && stockMatch;
  });

  return sortProducts(filtered, options.sortOption, q);
};

export const buildProductIndexes = (products: CatalogProduct[]) => {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const countByCategory = new Map<string, number>();

  products.forEach((product) => {
    const membership = Array.isArray(product.categoryIds) && product.categoryIds.length > 0
      ? product.categoryIds
      : [product.categoryId];

    const uniqueMembership = Array.from(new Set(membership.filter((value) => typeof value === 'string' && value.length > 0)).values());
    uniqueMembership.forEach((categoryId) => {
      countByCategory.set(categoryId, (countByCategory.get(categoryId) ?? 0) + 1);
    });
  });

  return { productsById, countByCategory };
};
