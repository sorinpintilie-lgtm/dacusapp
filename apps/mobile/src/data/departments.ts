import type { CatalogCategory, CatalogProduct } from './catalog';

/**
 * Shopify collections are flat (84 of them, from "Construcții și Renovare" with 2,000+ products down to
 * one-product collections). The app groups them into departments the way the shop orders them, so
 * browsing starts from a dozen clear entry points with their sub-collections one tap away.
 *
 * Matching is by name (case and diacritics ignored). A collection that matches nothing lands in "Altele",
 * so new collections created in Shopify still show up.
 */
type DepartmentDefinition = {
  id: string;
  name: string;
  /** The department's own collection, if the shop has one (its photo becomes the cover). */
  lead?: string;
  children: string[];
};

const DEFINITIONS: DepartmentDefinition[] = [
  {
    id: 'constructii',
    name: 'Construcții și Renovare',
    lead: 'Construcții și Renovare',
    children: [
      'Materiale de construcții',
      'Izolații și hidroizolații',
      'Gresie',
      'Faianță',
      'Vopsele, zugrăveli și accesorii',
      'Sisteme de fixare și prindere',
      'Uși și feronerie',
      'Garduri și Porți',
      'Accesorii șantier',
      'Echipamente de lucru și protecție',
    ],
  },
  {
    id: 'scule',
    name: 'Scule și Unelte',
    lead: 'Scule și Unelte',
    children: [
      'Unelte și scule electrice',
      'Mașini de găurit și tăiat',
      'Unelte de mână',
      'Seturi și truse',
      'Accesorii unelte',
      'Compresoare',
    ],
  },
  {
    id: 'electrice',
    name: 'Electrice și Iluminat',
    lead: 'Electrice și Iluminat',
    children: [
      'Corpuri de iluminat',
      'Iluminat',
      'Becuri și LED-uri',
      'Becuri LED',
      'Instalații electrice',
      'Accesorii electrice',
      'Cabluri, adaptoare și conectică',
      'Baterii, acumulatori și încărcătoare',
      'Componente electronice',
    ],
  },
  {
    id: 'baie',
    name: 'Baie și Instalații',
    lead: 'Baie și Instalații',
    children: [
      'Obiecte sanitare',
      'Baterii și robineți',
      'Accesorii baie',
      'Instalații apă și canalizare',
      'Filtrare Apă',
    ],
  },
  {
    id: 'bucatarie',
    name: 'Bucătărie și Dining',
    lead: 'Bucătărie și Dining',
    children: ['Vase și tigăi', 'Ustensile bucătărie', 'Accesorii gătit', 'Depozitare alimente'],
  },
  {
    id: 'mobilier',
    name: 'Mobilier',
    lead: 'Mobilier',
    children: [
      'Mobilier living',
      'Mobilier dormitor',
      'Mobilier bucătărie',
      'Mobilier baie',
      'Mobilier birou',
      'Mobilier exterior',
    ],
  },
  {
    id: 'casa-gradina',
    name: 'Casă și Grădină',
    lead: 'Casă și Grădină',
    children: [
      'Grădină și Exterior',
      'Produse pentru gradinarit',
      'Depozitare și organizare',
      'Textile și decorațiuni',
      'Produse pentru animale',
      'Articole și accesorii pentru pescuit',
    ],
  },
  {
    id: 'electronice',
    name: 'Electronice și Electrocasnice',
    lead: 'Electronice & Gadgeturi',
    children: [
      'Electrocasnice mici',
      'Electrocasnice mari',
      'Articole de climatizare',
      'Electronice',
      'Gadgeturi și accesorii tech',
      'Echipamente audio și sonorizare',
    ],
  },
  {
    id: 'curatenie',
    name: 'Curățenie și Întreținere',
    lead: 'Curățenie și Întreținere',
    children: [
      'Detergenți și produse curățenie',
      'Mături, mopuri, lavete',
      'Consumabile întreținere',
      'Îngrijire casă și curățenie',
      'Îngrijire personală și cosmetice',
    ],
  },
  {
    id: 'copii',
    name: 'Jucării și Copii',
    lead: 'Jucării și Copii',
    children: [
      'Jucării educative',
      'Jucării de exterior',
      'Jucării pentru bebeluși',
      'Articole pentru școală și grădiniță',
      'Birotică și papetărie',
      'Biciclete',
      'Fitness și sport',
    ],
  },
  { id: 'auto', name: 'Auto și Moto', lead: 'Auto și Moto', children: [] },
  {
    id: 'craciun',
    name: 'Crăciun',
    lead: 'Craciun',
    children: [
      'Decoratiuni brad',
      'Brazi',
      'Lumini de sezon',
      'Lumanari parfumate de craciun',
      'Imbracaminte craciun',
      'Pungi de cadou',
    ],
  },
  {
    id: 'imbracaminte',
    name: 'Îmbrăcăminte',
    lead: 'Îmbrăcăminte',
    children: ['Reducere încălțăminte'],
  },
];

export const OTHER_DEPARTMENT_ID = 'altele';

export type Department = {
  id: string;
  name: string;
  /** The department's own collection, when the shop has one. */
  lead?: CatalogCategory;
  /** Sub-collections that have products, in the order above. */
  children: CatalogCategory[];
  /** Every collection id in the department (lead included). */
  categoryIds: string[];
  productCount: number;
};

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Builds the departments from the collections present in the catalog. Collections without products are
 * left out; departments are ordered by how many products they hold, "Altele" last.
 */
export const buildDepartments = (
  categories: CatalogCategory[],
  productsByCategory: Map<string, CatalogProduct[]>,
): Department[] => {
  const byName = new Map(categories.map((category) => [fold(category.name), category]));
  const hasProducts = (category: CatalogCategory | undefined): category is CatalogCategory =>
    !!category && (productsByCategory.get(category.id)?.length ?? 0) > 0;
  const assigned = new Set<string>();

  const countProducts = (ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids)
      for (const product of productsByCategory.get(id) ?? []) seen.add(product.id);
    return seen.size;
  };

  const departments: Department[] = [];
  for (const definition of DEFINITIONS) {
    const lead = definition.lead ? byName.get(fold(definition.lead)) : undefined;
    const children = definition.children.map((name) => byName.get(fold(name))).filter(hasProducts);
    const members = [...(hasProducts(lead) ? [lead] : []), ...children];
    if (members.length === 0) continue;
    members.forEach((category) => assigned.add(category.id));
    if (lead) assigned.add(lead.id);
    const categoryIds = members.map((category) => category.id);
    departments.push({
      id: definition.id,
      name: definition.name,
      ...(hasProducts(lead) ? { lead } : {}),
      children,
      categoryIds,
      productCount: countProducts(categoryIds),
    });
  }

  const leftovers = categories.filter(
    (category) => !assigned.has(category.id) && hasProducts(category),
  );
  departments.sort((a, b) => b.productCount - a.productCount);
  if (leftovers.length > 0) {
    const categoryIds = leftovers.map((category) => category.id);
    departments.push({
      id: OTHER_DEPARTMENT_ID,
      name: 'Altele',
      children: leftovers,
      categoryIds,
      productCount: countProducts(categoryIds),
    });
  }
  return departments;
};

/** The department's products, each once, in catalog order. */
export const departmentProducts = (department: Department, products: CatalogProduct[]) => {
  const ids = new Set(department.categoryIds);
  return products.filter((product) =>
    (product.categoryIds && product.categoryIds.length > 0
      ? product.categoryIds
      : [product.categoryId]
    ).some((id) => ids.has(id)),
  );
};
