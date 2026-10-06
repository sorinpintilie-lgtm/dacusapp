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

const foldText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeText = (value: string) => foldText(value).replace(/\s+/g, ' ').trim();

const hasAnyKeyword = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

const LIMITED_STOCK_KEYWORDS = ['stoc limitat', 'ultimele bucati', 'stoc redus', 'limited'];
// Checked first: negated labels such as "Nu este în stoc" also contain "in stoc".
const OUT_OF_STOCK_KEYWORDS = [
  'nu este in stoc',
  'nu mai este in stoc',
  'nu e in stoc',
  'lipsa stoc',
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

  // Score each product once: scoring normalizes several fields, and the comparator runs n log n times.
  const scores = new Map(items.map((item) => [item, computeRelevanceScore(item, normalizedQuery)]));

  return [...items].sort((a, b) => {
    const scoreDiff = (scores.get(b) ?? 0) - (scores.get(a) ?? 0);
    if (scoreDiff !== 0) return scoreDiff;

    const discountDiff = Number((b.oldPriceRon ?? 0) > b.priceRon) - Number((a.oldPriceRon ?? 0) > a.priceRon);
    if (discountDiff !== 0) return discountDiff;

    return a.name.localeCompare(b.name, 'ro');
  });
};

// Folded search text per product, built on first search (it includes the description, so it is costly to
// build for the whole catalog). Whitespace is not collapsed: query tokens never contain any.
const searchHaystackCache = new WeakMap<CatalogProduct, string>();

const getSearchHaystack = (product: CatalogProduct) => {
  let haystack = searchHaystackCache.get(product);
  if (haystack === undefined) {
    haystack = foldText(
      `${product.name} ${product.brand} ${product.description ?? ''} ${product.handle ?? ''} ${product.sku ?? ''} ${product.id}`,
    );
    searchHaystackCache.set(product, haystack);
  }
  return haystack;
};

export const filterProducts = (source: CatalogProduct[], options: FilterOptions): CatalogProduct[] => {
  const q = normalizeText(options.query);
  const queryTokens = q.length > 0 ? q.split(' ').filter((token) => token.length > 0) : [];
  const brandFilter = options.brandFilter === 'toate' ? null : normalizeText(options.brandFilter);

  const filtered = source.filter((item) => {
    if (brandFilter !== null && normalizeText(item.brand) !== brandFilter) return false;
    if (!matchesPriceFilter(item.priceRon, options.priceFilter)) return false;
    if (options.onlyDiscount && !((item.oldPriceRon ?? 0) > item.priceRon)) return false;
    if (options.onlyInStock && !isProductInStock(item)) return false;
    if (queryTokens.length === 0) return true;

    const haystack = getSearchHaystack(item);
    return queryTokens.every((token) => haystack.includes(token));
  });

  return sortProducts(filtered, options.sortOption, q);
};

// Runs over the whole catalog at startup: plain loops, no per-product arrays, sets or closures.
export const buildProductIndexes = (products: CatalogProduct[]) => {
  const productsById = new Map<string, CatalogProduct>();
  const countByCategory = new Map<string, number>();

  for (const product of products) {
    productsById.set(product.id, product);

    const membership = Array.isArray(product.categoryIds) && product.categoryIds.length > 0
      ? product.categoryIds
      : [product.categoryId];

    for (let index = 0; index < membership.length; index += 1) {
      const categoryId = membership[index];
      // Count each category once per product, even when it is listed twice.
      if (typeof categoryId !== 'string' || categoryId.length === 0 || membership.indexOf(categoryId) !== index) continue;
      countByCategory.set(categoryId, (countByCategory.get(categoryId) ?? 0) + 1);
    }
  }

  return { productsById, countByCategory };
};
