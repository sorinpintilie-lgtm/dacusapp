/**
 * Shared string utilities for the Dacus app
 * Centralized here to avoid duplication across modules
 */

/**
 * Converts a string to a URL-friendly slug
 * Handles Romanian diacritics and special characters
 */
export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalizes text for searching/filtering
 * Converts to lowercase, removes diacritics, normalizes whitespace
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips category ID prefixes like "product-type-"
 */
export function stripCategoryPrefixes(value: string): string {
  return value.replace(/^product-type-/i, '');
}

/**
 * Normalizes a category token for comparison
 * Removes prefixes, converts to lowercase, removes diacritics and special chars
 */
export function normalizeCategoryToken(value: string): string {
  return stripCategoryPrefixes(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Parses a price value from various formats (string, number)
 * Handles Romanian format (comma as decimal separator)
 */
export function parsePriceValue(value: number | string | undefined): number {
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
}

/**
 * Escapes special characters in filter values for Typesense/similar search engines
 */
export function escapeFilterValue(value: string): string {
  return `\`${value.replace(/[`\\]/g, '\\$&')}\``;
}

/**
 * Checks if a category name represents a broad/general category
 */
export function isBroadCategoryName(value: string): boolean {
  const token = normalizeCategoryToken(value);
  return (
    token.length === 0 ||
    token === 'diverse' ||
    token === 'divers' ||
    token === 'all' ||
    token === 'toate' ||
    token === 'uncategorized' ||
    token.startsWith('general')
  );
}

/**
 * Truncates text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

const mojibakeFixMap: Record<string, string> = {
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

const mojibakePattern = new RegExp(Object.keys(mojibakeFixMap).join('|'), 'g');

export function fixRomanianMojibake(value: string): string {
  if (!value) return value;
  return value.replace(mojibakePattern, (match) => mojibakeFixMap[match] ?? match);
}
