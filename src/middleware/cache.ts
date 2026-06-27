import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';

const DEFAULT_CACHE_TTL = 300; // 5 minutes

/**
 * Redis response cache middleware.
 * Caches GET responses by URL + query params. Serves cached version if available.
 * Use on read-heavy public routes (job listings, company profiles, plans).
 */
export const cacheResponse = (ttlSeconds = DEFAULT_CACHE_TTL) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `cache:${req.originalUrl}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        res.status(200).json(parsed);
        return;
      }
    } catch {
      // If Redis fails, just skip cache and proceed normally
      return next();
    }

    // Override res.json to cache the response before sending
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Only cache successful responses
      if (res.statusCode === 200) {
        redis.set(cacheKey, JSON.stringify(body), 'EX', ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
};

/** Invalidates cache entries matching a pattern (e.g., all job listings) */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Cache invalidation failure is non-critical
  }
}
