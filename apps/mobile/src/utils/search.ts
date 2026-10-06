import type { CatalogProduct } from '../data/catalog';
import { isProductInStock } from './catalogFilters';

/**
 * Catalog search.
 *
 * A product matches when every word of the query starts a word of its name, brand or code, in any order and
 * ignoring case and diacritics ("led bec" finds "Bec LED", "incarcator" finds "Încărcător"). Product codes
 * also match partially ("0472" finds "ZAR0472"). Results are ranked: whole-phrase and whole-word matches in the
 * name first, then products in stock, then shorter (more specific) names.
 *
 * When nothing matches, the words are retried without common Romanian endings ("becuri" -> "bec"), and as a
 * last resort the descriptions are searched.
 */

export type SearchMode = 'name' | 'relaxed' | 'description' | 'none';

export type SearchResult = {
  products: CatalogProduct[];
  /** How the products were found; 'none' when the query is too short or nothing matched. */
  mode: SearchMode;
};

type Entry = {
  product: CatalogProduct;
  /** ' name brand sku ', folded, so `includes(' ' + word)` means "a word starts with". */
  words: string;
  /** ' name ', folded. */
  name: string;
  sku: string;
  inStock: boolean;
  description?: string;
};

export const MIN_QUERY_LENGTH = 2;

/** Lowercase, without diacritics (ă â î ș ş ț ţ), punctuation turned into single spaces. */
export const foldForSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const indexCache = new WeakMap<CatalogProduct[], Entry[]>();

const getIndex = (source: CatalogProduct[]) => {
  let entries = indexCache.get(source);
  if (!entries) {
    entries = new Array<Entry>(source.length);
    for (let index = 0; index < source.length; index += 1) {
      const product = source[index] as CatalogProduct;
      const name = foldForSearch(product.name);
      const sku = foldForSearch(product.sku ?? '').replace(/ /g, '');
      entries[index] = {
        product,
        words: ` ${name} ${foldForSearch(product.brand)} ${sku} `,
        name: ` ${name} `,
        sku,
        inStock: isProductInStock(product),
      };
    }
    indexCache.set(source, entries);
  }
  return entries;
};

const ROMANIAN_ENDINGS = ['urilor', 'urile', 'ului', 'elor', 'ilor', 'uri', 'ele', 'ile', 'lor', 'ul', 'le', 'ii', 'ea', 'a', 'e', 'i'];

/** Strips a plural/article ending from longer words: "becuri" -> "bec", "lampile" -> "lamp". */
export const stemWord = (word: string) => {
  if (word.length < 5 || /\d/.test(word)) return word;
  for (const ending of ROMANIAN_ENDINGS) {
    if (word.endsWith(ending) && word.length - ending.length >= 3) return word.slice(0, -ending.length);
  }
  return word;
};

const looksLikeCode = (word: string) => word.length >= 3 && /\d/.test(word);

const matchesWord = (entry: Entry, word: string) =>
  entry.words.includes(` ${word}`) || (looksLikeCode(word) && entry.sku.includes(word));

const score = (entry: Entry, phrase: string, words: string[]) => {
  let value = 0;
  const compactPhrase = phrase.replace(/ /g, '');
  if (entry.sku && entry.sku === compactPhrase) value += 120;
  else if (entry.sku && looksLikeCode(compactPhrase)) {
    // Codes are typed from the start or from the numeric end ("ZAR04", "0472" for ZAR0472).
    if (entry.sku.startsWith(compactPhrase)) value += 40;
    else if (entry.sku.endsWith(compactPhrase)) value += 30;
  }

  // The query as a run of whole words in the name ("bec led" in "Bec Led A60").
  if (entry.name.startsWith(` ${phrase} `)) value += 60;
  else if (entry.name.includes(` ${phrase} `)) value += 45;

  words.forEach((word, index) => {
    // A whole word beats a word that only starts with it ("alba" vs "albastru").
    if (entry.name.includes(` ${word} `)) value += 14;
    else if (entry.name.includes(` ${word}`)) value += 6;
    else value += 2; // matched through the brand, the code or the description
    // Romanian puts the main noun first ("robinet baie"): finding it in the name matters most.
    if (index === 0 && entry.name.includes(` ${word}`)) value += 10;
  });

  if (entry.inStock) value += 15;
  // Shorter names are usually the more specific match.
  return value - entry.name.length / 40;
};

const rank = (matches: Entry[], phrase: string, words: string[]) => {
  const scored = matches.map((entry, order) => ({ entry, order, value: score(entry, phrase, words) }));
  scored.sort((a, b) => b.value - a.value || a.order - b.order);
  return scored.map((item) => item.entry.product);
};

const findByWords = (entries: Entry[], words: string[]) => {
  const matches: Entry[] = [];
  for (const entry of entries) {
    let all = true;
    for (const word of words) {
      if (!matchesWord(entry, word)) {
        all = false;
        break;
      }
    }
    if (all) matches.push(entry);
  }
  return matches;
};

const findInDescriptions = (entries: Entry[], words: string[]) => {
  const matches: Entry[] = [];
  for (const entry of entries) {
    if (entry.description === undefined) entry.description = ` ${foldForSearch(entry.product.description ?? '')} `;
    const text = entry.description;
    if (words.every((word) => text.includes(` ${word}`) || entry.words.includes(` ${word}`))) matches.push(entry);
  }
  return matches;
};

export const searchProducts = (source: CatalogProduct[], query: string, limit = Number.POSITIVE_INFINITY): SearchResult => {
  const phrase = foldForSearch(query);
  if (phrase.length < MIN_QUERY_LENGTH) return { products: [], mode: 'none' };

  const words = Array.from(new Set(phrase.split(' ')));
  const entries = getIndex(source);
  const take = (products: CatalogProduct[], mode: SearchMode): SearchResult => ({
    products: Number.isFinite(limit) ? products.slice(0, limit) : products,
    mode,
  });

  const exact = findByWords(entries, words);
  if (exact.length > 0) return take(rank(exact, phrase, words), 'name');

  const stemmed = Array.from(new Set(words.map(stemWord)));
  if (stemmed.some((word, index) => word !== words[index]) || stemmed.length !== words.length) {
    const relaxed = findByWords(entries, stemmed);
    if (relaxed.length > 0) return take(rank(relaxed, stemmed.join(' '), stemmed), 'relaxed');
  }

  const described = findInDescriptions(entries, stemmed);
  if (described.length > 0) return take(rank(described, stemmed.join(' '), stemmed), 'description');

  return { products: [], mode: 'none' };
};

export type HighlightPart = { text: string; match: boolean };

/** Splits `text` into parts, flagging the beginnings of words that a search query matched (for bolding). */
export const splitHighlights = (text: string, query: string): HighlightPart[] => {
  const words = foldForSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return [{ text, match: false }];

  const parts: HighlightPart[] = [];
  for (const piece of text.split(/(\s+)/)) {
    if (!piece) continue;
    // Removing diacritics keeps one character per letter, so positions line up with the original.
    const folded = piece.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let length = 0;
    for (const word of words) if (word.length > length && folded.startsWith(word)) length = word.length;
    if (length > 0) {
      parts.push({ text: piece.slice(0, length), match: true });
      if (length < piece.length) parts.push({ text: piece.slice(length), match: false });
    } else {
      parts.push({ text: piece, match: false });
    }
  }
  return parts;
};
