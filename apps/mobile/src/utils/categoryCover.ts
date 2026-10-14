import type { CatalogCategory, CatalogProduct } from '../data/catalog';
import { isProductInStock } from './catalogFilters';

export type CategoryCover =
  | { kind: 'photo'; uri: string }
  /** No collection photo in the shop: one of its products stands in (shown whole, on the light well). */
  | { kind: 'product'; uri: string }
  | { kind: 'none' };

const isHttpUrl = (value: string | undefined): value is string =>
  !!value && /^https?:\/\//.test(value);

export const categoryCover = (
  category: CatalogCategory,
  products: CatalogProduct[] | undefined,
): CategoryCover => {
  if (isHttpUrl(category.imageUrl)) return { kind: 'photo', uri: category.imageUrl };
  let fallback: string | undefined;
  for (const product of products ?? []) {
    const uri = product.thumbnailUrl ?? product.imageUrl;
    if (!isHttpUrl(uri)) continue;
    if (isProductInStock(product)) return { kind: 'product', uri };
    fallback ??= uri;
  }
  return fallback ? { kind: 'product', uri: fallback } : { kind: 'none' };
};

/** A department's cover: its own collection photo, else a sub-collection photo, else a product photo. */
export const departmentCover = (
  lead: CatalogCategory | undefined,
  children: CatalogCategory[],
  productsByCategory: Map<string, CatalogProduct[]>,
): CategoryCover => {
  const members = [...(lead ? [lead] : []), ...children];
  const photo = members.find((category) => isHttpUrl(category.imageUrl));
  if (photo?.imageUrl) return { kind: 'photo', uri: photo.imageUrl };
  for (const category of members) {
    const cover = categoryCover(category, productsByCategory.get(category.id));
    if (cover.kind !== 'none') return cover;
  }
  return { kind: 'none' };
};
