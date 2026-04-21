import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState, useCallback } from 'react';

type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
};

/**
 * Simple network check using fetch
 */
async function checkNetworkStatus(): Promise<NetInfoState> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Try to reach a known endpoint
    const response = await fetch('https://www.google.com', {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return {
      isConnected: response.ok,
      isInternetReachable: response.ok,
      type: 'wifi',
    };
  } catch {
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
    };
  }
}

/**
 * Hook to monitor network connectivity
 */
export function useNetworkStatus() {
  const [networkState, setNetworkState] = useState<NetInfoState>({
    isConnected: null,
    isInternetReachable: null,
    type: null,
  });

  useEffect(() => {
    // Check initial state
    checkNetworkStatus().then(setNetworkState);

    // Periodic check every 10 seconds
    const interval = setInterval(() => {
      checkNetworkStatus().then(setNetworkState);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return networkState;
}

/**
 * Cache manager for offline data
 */
export class OfflineCache {
  private cachePrefix = 'offline-';

  /**
   * Get cached data by key
   */
  async getCached<T>(key: string): Promise<T | null> {
    try {
      const cacheFile = `${FileSystem.cacheDirectory ?? ''}${this.cachePrefix}${key}.json`;
      const fileInfo = await FileSystem.getInfoAsync(cacheFile);

      if (!fileInfo.exists) return null;

      const raw = await FileSystem.readAsStringAsync(cacheFile);
      const parsed = JSON.parse(raw) as { data: T; expiresAt: number };

      // Check if cache is expired
      if (parsed.expiresAt < Date.now()) {
        await FileSystem.deleteAsync(cacheFile, { idempotent: true });
        return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  }

  /**
   * Set cached data with optional duration
   */
  async setCached<T>(key: string, data: T, durationMs?: number): Promise<void> {
    try {
      const cacheFile = `${FileSystem.cacheDirectory ?? ''}${this.cachePrefix}${key}.json`;
      const record = {
        data,
        expiresAt: Date.now() + (durationMs ?? 24 * 60 * 60 * 1000), // Default 24 hours
      };

      await FileSystem.writeAsStringAsync(cacheFile, JSON.stringify(record));
    } catch {
      // Silently fail - cache is not critical
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return;

      const files = await FileSystem.readDirectoryAsync(cacheDir);
      const offlineFiles = files.filter((f: string) => f.startsWith(this.cachePrefix));

      await Promise.all(
        offlineFiles.map((f: string) =>
          FileSystem.deleteAsync(`${cacheDir}${f}`, { idempotent: true }),
        ),
      );
    } catch {
      // Silently fail
    }
  }
}

// Singleton instance
export const offlineCache = new OfflineCache();

/**
 * React hook for offline support with caching
 */
export function useOfflineData<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  options?: {
    enabled?: boolean;
    cacheDuration?: number;
    fallbackData?: T;
  },
) {
  const [data, setData] = useState<T | undefined>(options?.fallbackData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const networkState = useNetworkStatus();

  useEffect(() => {
    const isConnected = networkState.isConnected && networkState.isInternetReachable;
    setIsOffline(!isConnected);
  }, [networkState]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const isConnected = await checkNetworkStatus();

    if (!isConnected.isConnected) {
      // Try to get cached data
      const cached = await offlineCache.getCached<T>(cacheKey);
      if (cached) {
        setData(cached);
        setIsOffline(true);
      } else if (options?.fallbackData) {
        setData(options.fallbackData);
      } else {
        setError(new Error('Eroare de conectare. Verifică conexiunea la internet.'));
      }
      setIsLoading(false);
      return;
    }

    try {
      const result = await fetchFn();
      setData(result);

      // Cache the result
      await offlineCache.setCached(cacheKey, result, options?.cacheDuration);
    } catch (err) {
      // On error, try cached/fallback
      const cached = await offlineCache.getCached<T>(cacheKey);
      if (cached) {
        setData(cached);
      } else if (options?.fallbackData) {
        setData(options.fallbackData);
      } else {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      setIsLoading(false);
    };
  }, [fetchFn, cacheKey, options?.fallbackData, options?.cacheDuration]);

  return {
    data,
    isLoading,
    error,
    isOffline,
    refresh,
    isStale: isOffline,
  };
}

export type { NetInfoState };
