import { useNavigation } from '@react-navigation/native';

import { useStableCallback } from '../utils/useStableCallback';

/** Stable callbacks for opening the product page and search from any screen. */
export function useShopNavigation() {
  const navigation = useNavigation();

  const openProduct = useStableCallback((productId: string) => {
    navigation.navigate('Product', { productId });
  });

  const openSearch = useStableCallback((initialQuery?: string) => {
    navigation.navigate('Search', initialQuery ? { initialQuery } : undefined);
  });

  return { openProduct, openSearch };
}
