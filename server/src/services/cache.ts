import NodeCache from 'node-cache';

interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
}

class StatsCache {
  private cache: NodeCache;

  constructor(ttlSeconds = 60) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: ttlSeconds * 2,
      useClones: false, // Better performance for read-only data
    });
  }

  async getOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const data = await fetcher();
    this.cache.set(key, data);
    return data;
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache.del(key);
    } else {
      this.cache.flushAll();
    }
  }

  getStats(): CacheStats {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
    };
  }
}

// Singleton instance for admin stats (60 second TTL per CONTEXT.md)
export const adminStatsCache = new StatsCache(60);
