import { PixelRatio } from 'react-native';

/**
 * Shopify's CDN resizes images on request. Collection images are uploaded at full camera resolution
 * (up to ~6000px wide), so ask for about the displayed size instead of decoding the original.
 */
export const sizedImageUrl = (url: string | undefined, displayWidth: number) => {
  if (!url || !url.includes('cdn.shopify.com')) return url;
  const width = Math.min(2048, Math.round(displayWidth * PixelRatio.get()));
  return `${url}${url.includes('?') ? '&' : '?'}width=${width}`;
};
