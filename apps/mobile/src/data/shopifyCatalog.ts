/**
 * Shopify Storefront queries and mapping for the product catalog.
 *
 * Shared by the app (refreshing products changed since the bundled catalog was built) and by
 * scripts/refresh-mobile-catalog.mjs (rebuilding the bundled catalog). Keep it free of imports and of
 * TypeScript-only runtime syntax: Node loads this file directly by stripping its types.
 */

export type ShopifyCategory = { id: string; name: string; description: string; imageUrl?: string };

export type ShopifyProduct = {
  id: string;
  categoryId: string;
  categoryIds: string[];
  handle?: string;
  sku?: string;
  variantId?: string;
  name: string;
  brand: string;
  description: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  priceRon: number;
  oldPriceRon?: number;
  stockLabel: string;
  variants: Array<{ id: string; name: string; priceRon: number; inStock: boolean }>;
};

type Money = { amount: string };
type ProductNode = {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  description: string;
  availableForSale: boolean;
  featuredImage?: { thumbnailUrl: string; imageUrl: string } | null;
  collections?: { edges: Array<{ node: { id: string } }> };
  variants?: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        sku?: string | null;
        availableForSale: boolean;
        price: Money;
        compareAtPrice?: Money | null;
      };
    }>;
  };
};
type CollectionNode = {
  id: string;
  title: string;
  description: string;
  image?: { url: string } | null;
};
type PageInfo = { hasNextPage: boolean; endCursor: string | null };

export const STOREFRONT_API_VERSION = '2024-10';
export const PAGE_SIZE = 250;

export const COLLECTIONS_QUERY = `
  query CatalogCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id title description image { url } } }
    }
  }
`;

// `$query` narrows the products, e.g. "updated_at:>'2026-05-04T10:36:25Z'".
export const PRODUCTS_QUERY = `
  query CatalogProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, sortKey: ID, query: $query) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          vendor
          description
          availableForSale
          featuredImage {
            thumbnailUrl: url(transform: { maxWidth: 420, maxHeight: 420, crop: CENTER })
            imageUrl: url(transform: { maxWidth: 960, maxHeight: 960, crop: CENTER })
          }
          collections(first: 20) { edges { node { id } } }
          variants(first: 20) {
            edges {
              node {
                id
                title
                sku
                availableForSale
                price { amount }
                compareAtPrice { amount }
              }
            }
          }
        }
      }
    }
  }
`;

// Some Shopify texts carry UTF-8 that was read as Latin-1 ("Ã®" instead of "î").
const MOJIBAKE: Record<string, string> = {
  Äƒ: 'ă',
  'Ä‚': 'Ă',
  'Ã¢': 'â',
  'Ã‚': 'Â',
  'Ã®': 'î',
  ÃŽ: 'Î',
  'È™': 'ș',
  'È˜': 'Ș',
  'È›': 'ț',
  Èš: 'Ț',
  'Â·': '·',
  'â€¢': '•',
  'â€”': '-',
  'â€“': '-',
};
const MOJIBAKE_PATTERN = new RegExp(Object.keys(MOJIBAKE).join('|'), 'g');
export const fixText = (value: string) =>
  value.replace(MOJIBAKE_PATTERN, (match) => MOJIBAKE[match] ?? match);

export const mapCategory = (node: CollectionNode): ShopifyCategory => ({
  id: node.id,
  name: fixText(node.title),
  description: fixText(node.description || ''),
  ...(node.image?.url ? { imageUrl: node.image.url } : {}),
});

export const mapProduct = (node: ProductNode, knownCategoryIds: Set<string>): ShopifyProduct => {
  const collectionIds = Array.from(
    new Set(
      (node.collections?.edges ?? [])
        .map((edge) => edge.node.id)
        .filter((id) => knownCategoryIds.has(id)),
    ),
  );
  const variantNodes = (node.variants?.edges ?? []).map((edge) => edge.node);
  const firstVariant = variantNodes[0];
  const priceRon = Number(firstVariant?.price.amount ?? 0);
  const oldPriceRon = firstVariant?.compareAtPrice?.amount
    ? Number(firstVariant.compareAtPrice.amount)
    : undefined;

  return {
    id: node.id,
    categoryId: collectionIds[0] ?? 'uncategorized',
    categoryIds: collectionIds.length > 0 ? collectionIds : ['uncategorized'],
    handle: node.handle,
    ...(firstVariant?.sku ? { sku: firstVariant.sku } : {}),
    ...(firstVariant?.id ? { variantId: firstVariant.id } : {}),
    name: fixText(node.title),
    brand: fixText(node.vendor || 'Dacus'),
    description: fixText(node.description || ''),
    ...(node.featuredImage?.thumbnailUrl ? { thumbnailUrl: node.featuredImage.thumbnailUrl } : {}),
    ...(node.featuredImage?.imageUrl ? { imageUrl: node.featuredImage.imageUrl } : {}),
    priceRon,
    ...(typeof oldPriceRon === 'number' && oldPriceRon > priceRon ? { oldPriceRon } : {}),
    stockLabel: node.availableForSale ? 'În stoc' : 'Nu este în stoc',
    variants: variantNodes.map((variant) => ({
      id: variant.id,
      name: fixText(variant.title),
      priceRon: Number(variant.price.amount),
      inStock: Boolean(variant.availableForSale),
    })),
  };
};

type QueryFn = <T>(query: string, variables: Record<string, unknown>) => Promise<T>;

/** A Storefront GraphQL client for the given shop and public token. */
export const createStorefrontClient = (
  domain: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): QueryFn => {
  const endpoint = `https://${domain}/api/${STOREFRONT_API_VERSION}/graphql.json`;
  return async <T>(query: string, variables: Record<string, unknown>) => {
    let attempt = 0;
    while (true) {
      attempt += 1;
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token },
        body: JSON.stringify({ query, variables }),
      });
      if (!response.ok) {
        if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          continue;
        }
        throw new Error(`Shopify Storefront request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
      if (payload.errors?.length)
        throw new Error(payload.errors.map((item) => item.message).join('; '));
      if (!payload.data) throw new Error('Shopify Storefront returned no data.');
      return payload.data;
    }
  };
};

export const fetchCollections = async (query: QueryFn): Promise<ShopifyCategory[]> => {
  const categories: ShopifyCategory[] = [];
  let after: string | null = null;
  while (true) {
    const data: { collections: { pageInfo: PageInfo; edges: Array<{ node: CollectionNode }> } } =
      await query(COLLECTIONS_QUERY, { first: PAGE_SIZE, after });
    for (const edge of data.collections.edges) categories.push(mapCategory(edge.node));
    if (!data.collections.pageInfo.hasNextPage || !data.collections.pageInfo.endCursor)
      return categories;
    after = data.collections.pageInfo.endCursor;
  }
};

type FetchProductsOptions = {
  /** Only products changed after this moment (ISO date). */
  updatedSince?: string;
  /** Stop after this many pages (of 250). */
  maxPages?: number;
  onPage?: (count: number) => void;
};

export const fetchProducts = async (
  query: QueryFn,
  knownCategoryIds: Set<string>,
  { updatedSince, maxPages = Number.POSITIVE_INFINITY, onPage }: FetchProductsOptions = {},
): Promise<ShopifyProduct[]> => {
  const products: ShopifyProduct[] = [];
  const filter = updatedSince ? `updated_at:>'${updatedSince}'` : null;
  let after: string | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const data: { products: { pageInfo: PageInfo; edges: Array<{ node: ProductNode }> } } =
      await query(PRODUCTS_QUERY, {
        first: PAGE_SIZE,
        after,
        query: filter,
      });
    for (const edge of data.products.edges) products.push(mapProduct(edge.node, knownCategoryIds));
    onPage?.(products.length);
    if (!data.products.pageInfo.hasNextPage || !data.products.pageInfo.endCursor) break;
    after = data.products.pageInfo.endCursor;
  }
  return products;
};
