/**
 * Cache Middleware
 * Caches responses using Redis to reduce load on backend services
 */

import Redis from 'ioredis';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  logger.error('Redis cache error:', err);
});

redis.on('connect', () => {
  logger.info('Redis cache connected');
});

/**
 * Generate cache key from request
 */
function getCacheKey(req) {
  const key = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
  return crypto.createHash('md5').update(key).digest('hex');
}

/**
 * Cache middleware factory
 */
export function cacheMiddleware(options = {}) {
  const {
    ttl = 60,                    // Time to live in seconds
    enabled = true,              // Enable/disable caching
    excludeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'], // Don't cache mutations
    excludePaths = [],           // Paths to exclude from caching
  } = options;

  return async (req, res, next) => {
    // Skip if caching is disabled
    if (!enabled) {
      return next();
    }

    // Skip if method should not be cached
    if (excludeMethods.includes(req.method)) {
      return next();
    }

    // Skip if path should not be cached
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Generate cache key
    const cacheKey = `cache:${getCacheKey(req)}`;

    try {
      // Try to get cached response
      const cached = await redis.get(cacheKey);

      if (cached) {
        const data = JSON.parse(cached);
        logger.debug(`Cache HIT: ${cacheKey}`);

        // Send cached response
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        return res.status(data.statusCode).json(data.body);
      }

      logger.debug(`Cache MISS: ${cacheKey}`);
      res.set('X-Cache', 'MISS');

      // Intercept response to cache it
      const originalJson = res.json;
      res.json = function(body) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cacheData = {
            statusCode: res.statusCode,
            body,
            cachedAt: new Date().toISOString(),
          };

          // Store in cache asynchronously
          redis.setex(cacheKey, ttl, JSON.stringify(cacheData))
            .catch(err => logger.error('Failed to cache response:', err));

          logger.debug(`Cached response: ${cacheKey} (TTL: ${ttl}s)`);
        }

        return originalJson.call(this, body);
      };

      next();

    } catch (error) {
      // If cache fails, continue without caching
      logger.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Invalidate cache for specific patterns
 */
export async function invalidateCache(pattern) {
  try {
    const keys = await redis.keys(`cache:*${pattern}*`);

    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Invalidated ${keys.length} cache entries matching: ${pattern}`);
      return keys.length;
    }

    return 0;
  } catch (error) {
    logger.error('Cache invalidation error:', error);
    throw error;
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache() {
  try {
    const keys = await redis.keys('cache:*');

    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Cleared ${keys.length} cache entries`);
      return keys.length;
    }

    return 0;
  } catch (error) {
    logger.error('Clear cache error:', error);
    throw error;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    const keys = await redis.keys('cache:*');
    const info = await redis.info('stats');

    // Parse info string
    const stats = {};
    info.split('\r\n').forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        stats[key] = value;
      }
    });

    return {
      totalKeys: keys.length,
      hits: parseInt(stats.keyspace_hits || 0),
      misses: parseInt(stats.keyspace_misses || 0),
      hitRate: stats.keyspace_hits && stats.keyspace_misses
        ? (parseInt(stats.keyspace_hits) / (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses)) * 100).toFixed(2) + '%'
        : 'N/A',
    };
  } catch (error) {
    logger.error('Get cache stats error:', error);
    throw error;
  }
}

export { redis };
