import type { CatalogProduct } from '../data/catalog';

/**
 * The `count` smallest items by `compare`, in order, in one pass (O(n · count) instead of sorting everything).
 * Ties keep their input order, like a stable sort.
 */
export function takeSmallest<T>(items: Iterable<T>, count: number, compare: (a: T, b: T) => number): T[] {
  const best: T[] = [];
  for (const item of items) {
    const last = best[best.length - 1];
    if (best.length === count && last !== undefined && compare(item, last) >= 0) continue;
    let index = best.length;
    while (index > 0) {
      const previous = best[index - 1];
      if (previous === undefined || compare(item, previous) >= 0) break;
      index -= 1;
    }
    best.splice(index, 0, item);
    if (best.length > count) best.pop();
  }
  return best;
}

const hasDiscount = (product: CatalogProduct) => (product.oldPriceRon ?? 0) > product.priceRon;

/** Same primary category, discounted first, then closest in price. */
export function getSimilarProducts(product: CatalogProduct, catalog: CatalogProduct[], limit = 8) {
  const candidates = catalog.filter((item) => item.id !== product.id && item.categoryId === product.categoryId);
  return takeSmallest(candidates, limit, (a, b) => {
    const discountDiff = Number(hasDiscount(b)) - Number(hasDiscount(a));
    if (discountDiff !== 0) return discountDiff;
    return Math.abs(a.priceRon - product.priceRon) - Math.abs(b.priceRon - product.priceRon);
  });
}

/** Same-brand upgrades from other categories (cheapest first), then the biggest discounts elsewhere. */
export function getUpsellProducts(
  product: CatalogProduct,
  catalog: CatalogProduct[],
  excludedIds: Set<string>,
  limit = 8,
) {
  const eligible = catalog.filter(
    (item) => item.id !== product.id && !excludedIds.has(item.id) && item.categoryId !== product.categoryId,
  );
  const premiumSameBrand = takeSmallest(
    eligible.filter((item) => item.brand === product.brand && item.priceRon >= product.priceRon),
    limit,
    (a, b) => a.priceRon - b.priceRon,
  );
  const savings = (item: CatalogProduct) => (item.oldPriceRon ?? item.priceRon) - item.priceRon;
  const promoted = takeSmallest(eligible.filter(hasDiscount), limit, (a, b) => {
    const savingsDiff = savings(b) - savings(a);
    return savingsDiff !== 0 ? savingsDiff : a.priceRon - b.priceRon;
  });

  const seen = new Set<string>();
  const result: CatalogProduct[] = [];
  for (const item of [...premiumSameBrand, ...promoted]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
    if (result.length === limit) break;
  }
  return result;
}

/** Up to `limit` same-brand products from other categories, in catalog order. */
export function getBundleProducts(product: CatalogProduct, catalog: CatalogProduct[], limit = 3) {
  const result: CatalogProduct[] = [];
  for (const item of catalog) {
    if (item.id !== product.id && item.categoryId !== product.categoryId && item.brand === product.brand) {
      result.push(item);
      if (result.length === limit) break;
    }
  }
  return result;
}
