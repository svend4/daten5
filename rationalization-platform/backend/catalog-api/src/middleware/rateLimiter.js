/**
 * Rate limiting middleware
 */

import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

// Redis store for rate limiting
class RedisStore {
  constructor(options) {
    this.prefix = options.prefix || 'rl:';
    this.client = redis;
  }

  async increment(key) {
    const fullKey = this.prefix + key;
    const current = await this.client.incr(fullKey);

    if (current === 1) {
      await this.client.expire(fullKey, 60); // 60 seconds window
    }

    return {
      totalHits: current,
      resetTime: new Date(Date.now() + 60000),
    };
  }

  async decrement(key) {
    const fullKey = this.prefix + key;
    await this.client.decr(fullKey);
  }

  async resetKey(key) {
    const fullKey = this.prefix + key;
    await this.client.del(fullKey);
  }
}

// Rate limiter configuration
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rate_limit:' }),
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/api/health';
  },
  keyGenerator: (req) => {
    // Use API key if available, otherwise use IP
    return req.headers['x-api-key'] || req.ip;
  },
});

// Stricter rate limit for expensive operations
export const strictRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    error: 'Too many expensive requests',
    message: 'This endpoint is rate limited to 10 requests per minute.',
  },
  store: new RedisStore({ prefix: 'rate_limit:strict:' }),
});
