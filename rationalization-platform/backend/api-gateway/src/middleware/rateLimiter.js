/**
 * Rate Limiting Middleware
 * Redis-backed rate limiting
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

/**
 * Standard rate limiter (100 requests/minute)
 */
export const rateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:standard:',
  }),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.user?.id || req.ip;
  },
});

/**
 * Strict rate limiter (10 requests/minute)
 * For expensive operations
 */
export const strictRateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:strict:',
  }),
  windowMs: 60000, // 1 minute
  max: 10,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded for this expensive operation.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
