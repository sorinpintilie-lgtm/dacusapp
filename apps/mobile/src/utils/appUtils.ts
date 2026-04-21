import { AccessibilityInfo, Linking, Platform, Dimensions, PixelRatio, Share } from 'react-native';

// ============================================
// ACCESSIBILITY UTILITIES
// ============================================

/**
 * Announce message to screen readers
 */
export function announceForAccessibility(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

/**
 * Check if screen reader is enabled
 */
export async function isScreenReaderEnabled(): Promise<boolean> {
  return AccessibilityInfo.isScreenReaderEnabled();
}

/**
 * Reduce motion preference
 */
export async function prefersReducedMotion(): Promise<boolean> {
  try {
    const result = await AccessibilityInfo.isReduceMotionEnabled();
    return result;
  } catch {
    return false;
  }
}

/**
 * Generate accessible label for product
 */
export function getProductAccessibilityLabel(product: {
  name?: string;
  brand?: string;
  price?: number;
  stock?: string;
}): string {
  const parts: string[] = [];

  if (product.name) parts.push(product.name);
  if (product.brand) parts.push(`de la ${product.brand}`);
  if (product.price) parts.push(`${product.price} lei`);
  if (product.stock) parts.push(product.stock);

  return parts.join(', ');
}

/**
 * Minimum touch target size (44x44 as per WCAG)
 */
export const MIN_TOUCH_SIZE = 44;

/**
 * Check if touch target meets minimum size
 */
export function meetsTouchTarget(size: { width: number; height: number }): boolean {
  return size.width >= MIN_TOUCH_SIZE && size.height >= MIN_TOUCH_SIZE;
}

// ============================================
// PERFORMANCE UTILITIES
// ============================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Normalize size across different device sizes
 * @param size - Design size in points
 */
export function normalize(size: number): number {
  const scale = SCREEN_WIDTH / 375; // iPhone SE as base
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

/**
 * Responsive width percentage
 */
export function responsiveWidth(percentage: number): number {
  return (SCREEN_WIDTH * percentage) / 100;
}

/**
 * Responsive height percentage
 */
export function responsiveHeight(percentage: number): number {
  return (SCREEN_HEIGHT * percentage) / 100;
}

/**
 * Debounce function for search/input
 */
export function debounce<T extends (...args: never[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for frequent events
 */
export function throttle<T extends (...args: never[]) => void>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Lazy image loading placeholder
 */
export const imagePlaceholders = {
  product:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  category:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  avatar:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
};

/**
 * Image quality presets
 */
export const imageQuality = {
  thumbnail: { width: 150, height: 150, quality: 60 },
  card: { width: 300, height: 300, quality: 75 },
  detail: { width: 600, height: 600, quality: 85 },
  full: { width: 1200, height: 1200, quality: 95 },
};

/**
 * Get optimized image URL (for Shopify CDN)
 */
export function getOptimizedImageUrl(
  url: string,
  options: { width?: number; height?: number; quality?: number } = {},
): string {
  if (!url) return '';

  // Already optimized
  if (url.includes('_')) return url;

  // Shopify image transformation
  const params: string[] = [];
  if (options.width) params.push(`width=${options.width}`);
  if (options.height) params.push(`height=${options.height}`);
  if (options.quality) params.push(`quality=${options.quality}`);

  return params.length > 0 ? `${url}?${params.join('&')}` : url;
}

// ============================================
// SHARE & SOCIAL
// ============================================

/**
 * Share product with others
 */
export async function shareProduct(product: {
  name: string;
  price?: number;
  url?: string;
  description?: string;
}): Promise<boolean> {
  try {
    const message = [
      `🏷️ ${product.name}`,
      product.price ? `💰 ${product.price} lei` : null,
      product.description ? `\n${product.description}` : null,
      product.url ? `\n🔗 ${product.url}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const result = await Share.share({
      message,
      title: product.name,
      url: product.url,
    });

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('Share error:', error);
    return false;
  }
}

/**
 * Share app with others
 */
export async function shareApp(customMessage?: string): Promise<boolean> {
  try {
    const message = customMessage || 'Descarcă aplicația Dacus pentru scule și echipamente!';

    const result = await Share.share({
      message,
      title: 'Descarcă Dacus',
    });

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('Share error:', error);
    return false;
  }
}

/**
 * Open external URL (phone, email, maps)
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Link error:', error);
    return false;
  }
}

/**
 * Call phone number
 */
export function callPhone(phoneNumber: string): Promise<boolean> {
  const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
  return openExternalUrl(`tel:${cleanNumber}`);
}

/**
 * Send email
 */
export function sendEmail(to: string, subject?: string, body?: string): Promise<boolean> {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);

  const url = `mailto:${to}${params.length ? '?' + params.join('&') : ''}`;
  return openExternalUrl(url);
}

/**
 * Open maps with location
 */
export function openMaps(latitude: number, longitude: number, label?: string): Promise<boolean> {
  const encodedLabel = label ? encodeURIComponent(label) : '';
  const url =
    Platform.select({
      ios: `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encodedLabel}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`,
    }) || '';

  return openExternalUrl(url);
}

/**
 * Rate app in store
 */
export function rateApp(): Promise<boolean> {
  const url =
    Platform.select({
      ios: 'itms-apps://itunes.apple.com/app/idXXXXXXXXX?action=write-review',
      android: 'market://details?id=com.dacus.app',
    }) || '';

  return openExternalUrl(url);
}

/**
 * Open privacy policy
 */
export function openPrivacyPolicy(): Promise<boolean> {
  return openExternalUrl('https://dacus.ro/privacy');
}

/**
 * Open terms of service
 */
export function openTermsOfService(): Promise<boolean> {
  return openExternalUrl('https://dacus.ro/terms');
}

// ============================================
// ANALYTICS & TRACKING
// ============================================

/**
 * Analytics event types
 */
export type AnalyticsEvent =
  | 'screen_view'
  | 'product_view'
  | 'product_add_to_cart'
  | 'product_remove_from_cart'
  | 'search'
  | 'filter_apply'
  | 'checkout_start'
  | 'checkout_complete'
  | 'share'
  | 'error';

/**
 * Analytics event data
 */
interface AnalyticsEventData {
  screen_name?: string;
  screen_previous?: string;
  product_id?: string;
  product_name?: string;
  product_price?: number;
  product_brand?: string;
  product_category?: string;
  cart_value?: number;
  cart_items?: number;
  search_query?: string;
  search_results?: number;
  filter_type?: string;
  filter_value?: string;
  checkout_id?: string;
  checkout_value?: number;
  error_code?: string;
  error_message?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Track analytics event (console for now - integrate with Firebase Analytics later)
 */
export function trackEvent(event: AnalyticsEvent, data: AnalyticsEventData = {}): void {
  // timestamp reserved for production analytics
  // const timestamp = new Date().toISOString();

  // Log for development
  if (__DEV__) {
    console.log(`[Analytics] ${event}:`, data);
  }

  // In production, you would send to Firebase Analytics:
  // firebase.analytics().logEvent(event, { ...data, timestamp });
}

// Pre-defined event trackers
export const analytics = {
  screenView: (screenName: string, previousScreen?: string) =>
    trackEvent('screen_view', { screen_name: screenName, screen_previous: previousScreen }),

  productView: (product: {
    id: string;
    name: string;
    price?: number;
    brand?: string;
    category?: string;
  }) =>
    trackEvent('product_view', {
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      product_brand: product.brand,
      product_category: product.category,
    }),

  addToCart: (product: { id: string; name: string; price: number }, quantity = 1) =>
    trackEvent('product_add_to_cart', {
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      cart_value: product.price * quantity,
    }),

  removeFromCart: (product: { id: string; name: string; price: number }) =>
    trackEvent('product_remove_from_cart', {
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
    }),

  search: (query: string, resultsCount: number) =>
    trackEvent('search', { search_query: query, search_results: resultsCount }),

  filterApply: (filterType: string, filterValue: string) =>
    trackEvent('filter_apply', { filter_type: filterType, filter_value: filterValue }),

  checkoutStart: (cartValue: number, cartItems: number) =>
    trackEvent('checkout_start', { checkout_value: cartValue, cart_items: cartItems }),

  checkoutComplete: (checkoutId: string, value: number) =>
    trackEvent('checkout_complete', { checkout_id: checkoutId, checkout_value: value }),

  share: (contentType: string, contentId?: string) =>
    trackEvent('share', { product_id: contentId, filter_type: contentType }),

  error: (errorCode: string, errorMessage: string) =>
    trackEvent('error', { error_code: errorCode, error_message: errorMessage }),
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate phone number (Romanian format)
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '');
  return cleaned.length >= 9 && cleaned.length <= 12;
}

/**
 * Validate postal code (Romanian format)
 */
export function isValidPostalCode(code: string): boolean {
  const regex = /^[0-9]{6}$/;
  return regex.test(code);
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `+40 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format postal code
 */
export function formatPostalCode(code: string): string {
  return code.replace(/[^0-9]/g, '').slice(0, 6);
}

// ============================================
// DATE & TIME HELPERS
// ============================================

/**
 * Format date for display (Romanian locale)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format datetime for display
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time (Romanian)
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'acum';
  if (diffMins < 60) return `acum ${diffMins} minute`;
  if (diffHours < 24) return `acum ${diffHours} ore`;
  if (diffDays === 1) return 'ieri';
  if (diffDays < 7) return `acum ${diffDays} zile`;
  return formatDate(d);
}

/**
 * Estimate delivery date
 */
export function estimateDelivery(days = 2): string {
  const delivery = new Date();
  delivery.setDate(delivery.getDate() + days);
  return formatDate(delivery);
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Format price with currency
 */
export function formatPriceRON(amount: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ro-RO').format(num);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Calculate discount percentage
 */
export function calculateDiscount(original: number, current: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - current) / original) * 100);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Slugify text for URL
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
