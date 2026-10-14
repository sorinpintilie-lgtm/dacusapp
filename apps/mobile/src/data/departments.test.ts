import { describe, expect, it } from 'vitest';

import type { CatalogCategory, CatalogProduct } from './catalog';
import { buildDepartments, departmentProducts, OTHER_DEPARTMENT_ID } from './departments';

const category = (id: string, name: string): CatalogCategory => ({ id, name, description: '' });
const product = (id: string, categoryIds: string[]): CatalogProduct => ({
  id,
  categoryId: categoryIds[0] ?? 'uncategorized',
  categoryIds,
  name: id,
  brand: 'Dacus',
  priceRon: 10,
  stockLabel: 'În stoc',
});

const categories = [
  category('c-build', 'Constructii si Renovare'), // matched without diacritics
  category('c-tiles', 'Gresie'),
  category('c-paint', 'Vopsele, zugrăveli și accesorii'),
  category('c-kitchen', 'Bucătărie și Dining'),
  category('c-pots', 'Vase și tigăi'),
  category('c-new', 'Colecție nouă'),
  category('c-empty', 'Faianță'),
];
const products = [
  product('p1', ['c-build']),
  product('p2', ['c-tiles', 'c-build']),
  product('p3', ['c-paint']),
  product('p4', ['c-pots']),
  product('p5', ['c-new']),
];
const byCategory = new Map<string, CatalogProduct[]>();
for (const item of products) {
  for (const id of item.categoryIds ?? [])
    byCategory.set(id, [...(byCategory.get(id) ?? []), item]);
}

describe('buildDepartments', () => {
  const departments = buildDepartments(categories, byCategory);

  it('groups collections under departments, ignoring case and diacritics', () => {
    const build = departments.find((department) => department.id === 'constructii');
    expect(build?.lead?.id).toBe('c-build');
    expect(build?.children.map((child) => child.id)).toEqual(['c-tiles', 'c-paint']);
  });

  it('counts each product once per department', () => {
    expect(departments.find((department) => department.id === 'constructii')?.productCount).toBe(3);
  });

  it('leaves out collections without products and orders departments by size', () => {
    expect(departments.flatMap((department) => department.categoryIds)).not.toContain('c-empty');
    expect(departments.map((department) => department.id)).toEqual([
      'constructii',
      'bucatarie',
      OTHER_DEPARTMENT_ID,
    ]);
  });

  it('puts collections it does not know into "Altele" so nothing disappears', () => {
    const other = departments.at(-1);
    expect(other?.name).toBe('Altele');
    expect(other?.children.map((child) => child.id)).toEqual(['c-new']);
  });

  it("lists a department's products once each, in catalog order", () => {
    const build = departments[0];
    expect(build && departmentProducts(build, products).map((item) => item.id)).toEqual([
      'p1',
      'p2',
      'p3',
    ]);
  });
});
