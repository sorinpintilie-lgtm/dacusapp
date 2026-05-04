import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { readCatalogCacheEntry, writeCatalogCache } from './catalogCache';
import { loadLiveCatalog, loadCatalogStamp } from './storefront';

const CATALOG_BACKGROUND_TASK = 'catalog-background-refresh';

TaskManager.defineTask(CATALOG_BACKGROUND_TASK, async () => {
  try {
    console.log('[BACKGROUND][CatalogRefresh] Background task started');

    // Check if it's around 2 AM (between 1:45 AM and 2:15 AM)
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTimeMinutes = hour * 60 + minute;

    // 2 AM window: 1:45 AM (105 min) to 2:15 AM (135 min)
    const isInRefreshWindow = currentTimeMinutes >= 105 && currentTimeMinutes <= 135;

    if (!isInRefreshWindow) {
      console.log('[BACKGROUND][CatalogRefresh] Not in refresh window, skipping');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Check if we already refreshed today
    const cachedEntry = await readCatalogCacheEntry();
    const lastCheckedAt = cachedEntry?.lastCheckedAt ?? 0;
    const timeSinceLastCheckMs = Date.now() - lastCheckedAt;
    const hoursSinceLastCheck = timeSinceLastCheckMs / (1000 * 60 * 60);

    if (hoursSinceLastCheck < 20) {
      // Don't refresh if refreshed less than 20 hours ago
      console.log('[BACKGROUND][CatalogRefresh] Cache is fresh, skipping refresh');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log('[BACKGROUND][CatalogRefresh] Fetching fresh catalog data');

    // Fetch stamp to check for updates
    let stampPayload: { stamp: string } | null = null;
    try {
      stampPayload = await loadCatalogStamp();
    } catch (error) {
      console.warn('[BACKGROUND][CatalogRefresh] Stamp fetch failed, proceeding anyway', error);
    }

    // Check if stamp changed
    const stampMatchesCache =
      !!cachedEntry &&
      typeof cachedEntry.stamp === 'string' &&
      cachedEntry.stamp.length > 0 &&
      stampPayload?.stamp === cachedEntry.stamp;

    if (stampMatchesCache) {
      console.log('[BACKGROUND][CatalogRefresh] Stamp unchanged, skipping full refresh');
      // Still update the lastCheckedAt timestamp
      if (cachedEntry?.payload) {
        await writeCatalogCache(cachedEntry.payload, { stamp: cachedEntry.stamp });
      }
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Load full catalog
    const live = await loadLiveCatalog({
      pageSize: 1000, // Load more in background
      leanQuery: true,
      includeCategories: true,
    });

    // Cache it
    await writeCatalogCache(live, { stamp: stampPayload?.stamp ?? null });

    console.log('[BACKGROUND][CatalogRefresh] Successfully refreshed cache with', {
      categories: live.categories.length,
      products: live.products.length,
    });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[BACKGROUND][CatalogRefresh] Background task failed', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerCatalogBackgroundTask = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(CATALOG_BACKGROUND_TASK);
    if (isRegistered) {
      console.log('[BACKGROUND][CatalogRefresh] Task already registered');
      return;
    }

    await BackgroundFetch.registerTaskAsync(CATALOG_BACKGROUND_TASK, {
      minimumInterval: 60 * 60, // 1 hour in seconds
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log('[BACKGROUND][CatalogRefresh] Background task registered successfully');
  } catch (error) {
    console.error('[BACKGROUND][CatalogRefresh] Failed to register background task', error);
  }
};

export const unregisterCatalogBackgroundTask = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(CATALOG_BACKGROUND_TASK);
    if (!isRegistered) {
      return;
    }

    await BackgroundFetch.unregisterTaskAsync(CATALOG_BACKGROUND_TASK);
    console.log('[BACKGROUND][CatalogRefresh] Background task unregistered');
  } catch (error) {
    console.error('[BACKGROUND][CatalogRefresh] Failed to unregister background task', error);
  }
};
