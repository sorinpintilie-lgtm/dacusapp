import { describe, expect, it } from 'vitest';

import type { CatalogProduct } from '../data/catalog';
import { foldForSearch, searchProducts, splitHighlights, stemWord } from './search';

let nextId = 0;
const product = (name: string, extra: Partial<CatalogProduct> = {}): CatalogProduct => {
  nextId += 1;
  return {
    id: `p${nextId}`,
    categoryId: 'c1',
    name,
    brand: 'Dacus',
    priceRon: 10,
    stockLabel: 'În stoc',
    ...extra,
  };
};

const catalog = [
  product('Vopsea Albastru 07, Magic Efect Metalic'),
  product('Vopsea Superlavabila Alba Pt. Baie'),
  product('Bec Led A60 E27 9w', { sku: 'BEC0901' }),
  product('Lampa Led Tavan 36w Senzor Miscare', { sku: 'ZAR0472' }),
  product('Încărcător rapid tip C 5V 3A'),
  product('Set 3 Becuri 8.5w A60 E27'),
  product('Radiator Baie Portprosop', { description: 'Se montează lângă robinet.' }),
  product('Robinet lavoar crom', { description: 'Pentru baie și bucătărie.' }),
  product('Bec Led Filament E27', { brand: 'V-TAC', stockLabel: 'Nu este în stoc' }),
  product('Bec Led Lumanare E14', { brand: 'V-TAC' }),
  product('Ciocan cauciucat', { description: 'Mâner ergonomic din fibră de sticlă.' }),
];

const names = (query: string) => searchProducts(catalog, query).products.map((item) => item.name);

describe('foldForSearch', () => {
  it('drops case, diacritics (both comma and cedilla forms) and punctuation', () => {
    expect(foldForSearch('Încărcător, Șurubelniță / ŞŢ')).toBe('incarcator surubelnita st');
  });
});

describe('stemWord', () => {
  it('strips common Romanian plural and article endings from longer words only', () => {
    expect(stemWord('becuri')).toBe('bec');
    expect(stemWord('lampile')).toBe('lamp');
    expect(stemWord('bec')).toBe('bec');
    expect(stemWord('e27')).toBe('e27');
  });
});

describe('searchProducts', () => {
  it('ignores word order and case', () => {
    expect(names('led bec')).toEqual(names('BEC LED'));
    expect(names('led bec')).toContain('Bec Led A60 E27 9w');
  });

  it('ignores diacritics in the query and in product names', () => {
    expect(names('incarcator')).toEqual(['Încărcător rapid tip C 5V 3A']);
    expect(names('lampă tavan')).toEqual(['Lampa Led Tavan 36w Senzor Miscare']);
  });

  it('matches word beginnings, not the middle of words', () => {
    expect(names('ecu')).toEqual([]);
    expect(names('lumanare')).toEqual(['Bec Led Lumanare E14']);
  });

  it('finds products by full or partial code, exact code first', () => {
    expect(names('ZAR0472')[0]).toBe('Lampa Led Tavan 36w Senzor Miscare');
    expect(names('0472')).toEqual(['Lampa Led Tavan 36w Senzor Miscare']);
  });

  it('finds products by brand', () => {
    expect(names('v-tac')).toHaveLength(2);
  });

  it('ranks whole-word matches above words that only start with the query', () => {
    expect(names('vopsea alba')[0]).toBe('Vopsea Superlavabila Alba Pt. Baie');
  });

  it('ranks products in stock first', () => {
    expect(names('bec led filament lumanare')).toEqual([]);
    const vtac = names('v-tac bec');
    expect(vtac[0]).toBe('Bec Led Lumanare E14');
    expect(vtac[1]).toBe('Bec Led Filament E27');
  });

  it('retries without plural endings when nothing matches as typed', () => {
    const result = searchProducts(catalog, 'ciocane');
    expect(result.mode).toBe('relaxed');
    expect(result.products.map((item) => item.name)).toEqual(['Ciocan cauciucat']);
  });

  it('falls back to descriptions, preferring the first word in the name', () => {
    const result = searchProducts(catalog, 'robinet baie');
    expect(result.mode).toBe('description');
    expect(result.products[0]?.name).toBe('Robinet lavoar crom');
    expect(searchProducts(catalog, 'fibra sticla').products.map((item) => item.name)).toEqual(['Ciocan cauciucat']);
  });

  it('returns nothing for queries that are too short or match nothing', () => {
    expect(searchProducts(catalog, 'b')).toEqual({ products: [], mode: 'none' });
    expect(searchProducts(catalog, 'xyzqq')).toEqual({ products: [], mode: 'none' });
  });

  it('applies the limit after ranking', () => {
    expect(searchProducts(catalog, 'bec', 1).products).toHaveLength(1);
  });
});

describe('splitHighlights', () => {
  it('marks the matched beginning of each word, ignoring case and diacritics', () => {
    expect(splitHighlights('Încărcător rapid LED', 'incarc led')).toEqual([
      { text: 'Încărc', match: true },
      { text: 'ător', match: false },
      { text: ' ', match: false },
      { text: 'rapid', match: false },
      { text: ' ', match: false },
      { text: 'LED', match: true },
    ]);
  });

  it('returns the text untouched for an empty query', () => {
    expect(splitHighlights('Bec Led', '  ')).toEqual([{ text: 'Bec Led', match: false }]);
  });
});
