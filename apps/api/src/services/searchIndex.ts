import Typesense from 'typesense';

export type SearchProductDocument = {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  price: number;
  compareAtPrice?: number;
  hasDiscount: boolean;
  availableForSale: boolean;
  imageUrl: string;
  thumbnailUrl: string;
  variantCount: number;
  categoryId: string;
  categoryIds: string[];
  sku: string;
  createdAt: number;
};

export type SearchIndexConfig = {
  enabled: boolean;
  host?: string;
  port: number;
  protocol: 'http' | 'https';
  adminKey?: string;
  collectionName: string;
  timeoutSeconds: number;
};

const PRODUCT_SCHEMA = {
  name: 'products',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'handle', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'vendor', type: 'string', facet: true },
    { name: 'productType', type: 'string', facet: true },
    { name: 'tags', type: 'string[]', facet: true },
    { name: 'price', type: 'float', facet: true },
    { name: 'compareAtPrice', type: 'float', optional: true },
    { name: 'hasDiscount', type: 'bool', facet: true },
    { name: 'availableForSale', type: 'bool', facet: true },
    { name: 'imageUrl', type: 'string' },
    { name: 'thumbnailUrl', type: 'string' },
    { name: 'variantCount', type: 'int32' },
    { name: 'categoryId', type: 'string', facet: true },
    { name: 'categoryIds', type: 'string[]', facet: true },
    { name: 'sku', type: 'string', optional: true },
    { name: 'createdAt', type: 'int64' },
  ],
  default_sorting_field: 'createdAt',
};

const collectionSchemaFor = (collectionName: string) => ({
  ...PRODUCT_SCHEMA,
  name: collectionName,
});

const collectionNeedsMigration = (schema: unknown) => {
  const candidate = schema as { fields?: Array<{ name?: string; type?: string }> };
  const fields = Array.isArray(candidate.fields) ? candidate.fields : [];
  const hasCategoryId = fields.some(
    (field) => field.name === 'categoryId' && field.type === 'string',
  );
  const hasCategoryIds = fields.some(
    (field) => field.name === 'categoryIds' && field.type === 'string[]',
  );
  return !hasCategoryId || !hasCategoryIds;
};

export type SearchIndex = {
  enabled: boolean;
  ensureCollection: () => Promise<void>;
  upsertDocuments: (docs: SearchProductDocument[]) => Promise<void>;
  upsertDocument: (doc: SearchProductDocument) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  searchDocuments: (params: {
    query: string;
    page: number;
    perPage: number;
    sortBy: string;
    filterBy?: string;
    facetBy?: string;
  }) => Promise<{
    hits: Array<{ document: SearchProductDocument }>;
    found: number;
    page: number;
    facet_counts?: Array<{ field_name: string; counts: Array<{ value: string; count: number }> }>;
  }>;
};

const createDisabledIndex = (): SearchIndex => ({
  enabled: false,
  ensureCollection: async () => undefined,
  upsertDocuments: async () => undefined,
  upsertDocument: async () => undefined,
  deleteDocument: async () => undefined,
  searchDocuments: async () => ({
    hits: [],
    found: 0,
    page: 1,
    facet_counts: [],
  }),
});

export const createSearchIndex = (config: SearchIndexConfig): SearchIndex => {
  if (!config.enabled || !config.host || !config.adminKey) {
    return createDisabledIndex();
  }

  const client = new Typesense.Client({
    nodes: [{ host: config.host, port: config.port, protocol: config.protocol }],
    apiKey: config.adminKey,
    connectionTimeoutSeconds: config.timeoutSeconds,
  });

  const collection = () => client.collections(config.collectionName);
  const documents = () => collection().documents();

  return {
    enabled: true,
    ensureCollection: async () => {
      let needsCreate = false;

      try {
        const schema = await collection().retrieve();
        needsCreate = collectionNeedsMigration(schema);
      } catch {
        needsCreate = true;
      }

      if (!needsCreate) {
        return;
      }

      try {
        await collection().delete();
      } catch {
        // ignore missing collection
      }

      try {
        await client.collections().create(collectionSchemaFor(config.collectionName) as never);
      } catch {
        // another instance may have created it concurrently
      }
    },
    upsertDocuments: async (docs) => {
      if (docs.length === 0) return;
      await documents().import(docs, { action: 'upsert' });
    },
    upsertDocument: async (doc) => {
      await documents().upsert(doc);
    },
    deleteDocument: async (id) => {
      await collection().documents(id).delete();
    },
    searchDocuments: async ({ query, page, perPage, sortBy, filterBy, facetBy }) => {
      const result = await documents().search({
        q: query || '*',
        query_by: 'title,description,tags,vendor,sku,handle,productType',
        query_by_weights: '10,4,3,6,8,7,5',
        page,
        per_page: perPage,
        sort_by: sortBy,
        ...(filterBy ? { filter_by: filterBy } : {}),
        ...(facetBy ? { facet_by: facetBy } : {}),
        num_typos: 2,
        drop_tokens_threshold: 1,
        typo_tokens_threshold: 1,
        split_join_tokens: 'always',
        prefix: 'true,true,false,true,true,true,false',
        infix: 'off,off,off,off,always,always,off',
      });

      const payload = result as {
        hits?: Array<{ document: SearchProductDocument }>;
        found?: number;
        page?: number;
        facet_counts?: Array<{
          field_name: string;
          counts: Array<{ value: string; count: number }>;
        }>;
      };

      return {
        hits: payload.hits ?? [],
        found: payload.found ?? 0,
        page: payload.page ?? page,
        facet_counts: payload.facet_counts ?? [],
      };
    },
  };
};
