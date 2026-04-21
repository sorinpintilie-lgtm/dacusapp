import type { Firestore } from 'firebase-admin/firestore';

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
  name: string;
  brand: string;
  description?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  priceRon: number;
  oldPriceRon?: number;
  stockLabel: string;
};

export type CatalogStore = {
  getCategories: () => Promise<CatalogCategory[]>;
  setCategories: (categories: CatalogCategory[]) => Promise<void>;
  getProducts: () => Promise<CatalogProduct[]>;
  setProducts: (products: CatalogProduct[]) => Promise<void>;
  getStamp: () => Promise<{ stamp: string; generatedAt: string } | null>;
  setStamp: (stamp: { stamp: string; generatedAt: string }) => Promise<void>;
};

class InMemoryCatalogStore implements CatalogStore {
  private categories: CatalogCategory[] = [];
  private products: CatalogProduct[] = [];
  private stamp: { stamp: string; generatedAt: string } | null = null;

  async getCategories(): Promise<CatalogCategory[]> {
    return [...this.categories];
  }

  async setCategories(categories: CatalogCategory[]): Promise<void> {
    this.categories = [...categories];
  }

  async getProducts(): Promise<CatalogProduct[]> {
    return [...this.products];
  }

  async setProducts(products: CatalogProduct[]): Promise<void> {
    this.products = [...products];
  }

  async getStamp(): Promise<{ stamp: string; generatedAt: string } | null> {
    return this.stamp;
  }

  async setStamp(stamp: { stamp: string; generatedAt: string }): Promise<void> {
    this.stamp = { ...stamp };
  }
}

class FirestoreCatalogStore implements CatalogStore {
  constructor(private readonly db: Firestore) {}

  async getCategories(): Promise<CatalogCategory[]> {
    const snapshot = await this.db.collection('catalog').doc('meta').collection('categories').get();
    return snapshot.docs.map((doc) => doc.data() as CatalogCategory);
  }

  async setCategories(categories: CatalogCategory[]): Promise<void> {
    const batch = this.db.batch();
    const metaRef = this.db.collection('catalog').doc('meta');

    // Clear existing categories
    const existingSnapshot = await this.db
      .collection('catalog')
      .doc('meta')
      .collection('categories')
      .get();
    existingSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Add new categories
    categories.forEach((category) => {
      const ref = metaRef.collection('categories').doc(category.id);
      batch.set(ref, category);
    });

    await batch.commit();
  }

  async getProducts(): Promise<CatalogProduct[]> {
    const snapshot = await this.db.collection('catalog').doc('meta').collection('products').get();
    return snapshot.docs.map((doc) => doc.data() as CatalogProduct);
  }

  async setProducts(products: CatalogProduct[]): Promise<void> {
    const metaRef = this.db.collection('catalog').doc('meta');

    // Clear existing products in batches to avoid Firestore limits
    const existingSnapshot = await this.db
      .collection('catalog')
      .doc('meta')
      .collection('products')
      .get();
    const deletePromises: Promise<unknown>[] = [];
    for (let i = 0; i < existingSnapshot.docs.length; i += 500) {
      const batch = this.db.batch();
      existingSnapshot.docs.slice(i, i + 500).forEach((doc) => batch.delete(doc.ref));
      deletePromises.push(batch.commit());
    }
    await Promise.all(deletePromises);

    // Add new products in batches
    const addPromises: Promise<unknown>[] = [];
    for (let i = 0; i < products.length; i += 500) {
      const batch = this.db.batch();
      products.slice(i, i + 500).forEach((product) => {
        const ref = metaRef.collection('products').doc(product.id);
        batch.set(ref, product);
      });
      addPromises.push(batch.commit());
    }
    await Promise.all(addPromises);
  }

  async getStamp(): Promise<{ stamp: string; generatedAt: string } | null> {
    const doc = await this.db.collection('catalog').doc('stamp').get();
    if (!doc.exists) return null;
    const data = doc.data() as { stamp?: string; generatedAt?: string };
    if (!data.stamp || !data.generatedAt) return null;
    return { stamp: data.stamp, generatedAt: data.generatedAt };
  }

  async setStamp(stamp: { stamp: string; generatedAt: string }): Promise<void> {
    await this.db.collection('catalog').doc('stamp').set(stamp);
  }
}

export const createCatalogStore = (firestore: Firestore | null): CatalogStore => {
  if (!firestore) {
    return new InMemoryCatalogStore();
  }

  return new FirestoreCatalogStore(firestore);
};
