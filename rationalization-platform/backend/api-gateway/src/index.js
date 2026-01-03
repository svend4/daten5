/**
 * API Gateway
 * Central entry point for all client requests
 * Routes, aggregates, transforms, and secures microservice calls
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import responseTime from 'response-time';
import dotenv from 'dotenv';
import 'express-async-errors';

// Import local modules
import { logger } from './utils/logger.js';
import { rateLimiter, strictRateLimiter } from './middleware/rateLimiter.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { cacheMiddleware } from './middleware/cache.js';
import { circuitBreaker } from './middleware/circuitBreaker.js';
import { metricsMiddleware, metricsEndpoint } from './middleware/metrics.js';
import { aggregateRoutes } from './routes/aggregate.js';
import { transformRoutes } from './routes/transform.js';
import { healthRouter } from './routes/health.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================================
// SERVICE CONFIGURATION
// ============================================================================

const SERVICES = {
  catalog: {
    name: 'Catalog API',
    url: process.env.CATALOG_API_URL || 'http://catalog-api:3000',
    timeout: 30000,
    retries: 3,
  },
  ai: {
    name: 'AI Classifier',
    url: process.env.AI_CLASSIFIER_URL || 'http://ai-classifier:8001',
    timeout: 60000, // AI operations can be slower
    retries: 2,
  },
  blueprints: {
    name: 'Blueprint Engine',
    url: process.env.BLUEPRINT_ENGINE_URL || 'http://blueprint-engine:3001',
    timeout: 120000, // Blueprint execution can take time
    retries: 1,
  },
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
}));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Response time tracking
app.use(responseTime((req, res, time) => {
  logger.debug(`${req.method} ${req.url} - ${time.toFixed(2)}ms`);
}));

// Logging
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Metrics collection
app.use(metricsMiddleware);

// ============================================================================
// PUBLIC ROUTES (No Auth)
// ============================================================================

// Health check
app.use('/health', healthRouter);

// Metrics (for Prometheus)
app.get('/metrics', metricsEndpoint);

// API documentation
app.get('/', (req, res) => {
  res.json({
    name: 'Rationalization Platform API Gateway',
    version: '1.0.0',
    status: 'running',
    services: Object.keys(SERVICES),
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      catalog: '/api/*',
      ai: '/ai/*',
      blueprints: '/blueprints/*',
      aggregate: '/aggregate/*',
    },
    documentation: '/docs',
  });
});

// ============================================================================
// RATE LIMITING
// ============================================================================

// Global rate limiting
app.use('/api/', rateLimiter);
app.use('/ai/', strictRateLimiter); // AI endpoints are more expensive

// ============================================================================
// AUTHENTICATION (Optional)
// ============================================================================

// Apply authentication to protected routes
// app.use('/api/', authenticate); // Uncomment when auth is implemented

// ============================================================================
// SERVICE PROXIES WITH CIRCUIT BREAKER
// ============================================================================

/**
 * Catalog API Proxy
 * Routes: /api/*
 */
app.use('/api',
  cacheMiddleware({ ttl: 60 }), // Cache for 1 minute
  circuitBreaker('catalog'),
  createProxyMiddleware({
    target: SERVICES.catalog.url,
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api', // Keep /api prefix
    },
    timeout: SERVICES.catalog.timeout,
    onProxyReq: (proxyReq, req) => {
      logger.debug(`Proxying to Catalog API: ${req.method} ${req.path}`);
    },
    onError: (err, req, res) => {
      logger.error(`Catalog API proxy error: ${err.message}`);
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Catalog API is currently unavailable',
        service: 'catalog',
      });
    },
  })
);

/**
 * AI Classifier Proxy
 * Routes: /ai/*
 */
app.use('/ai',
  circuitBreaker('ai'),
  createProxyMiddleware({
    target: SERVICES.ai.url,
    changeOrigin: true,
    pathRewrite: {
      '^/ai': '', // Remove /ai prefix
    },
    timeout: SERVICES.ai.timeout,
    onProxyReq: (proxyReq, req) => {
      logger.debug(`Proxying to AI Classifier: ${req.method} ${req.path}`);
    },
    onError: (err, req, res) => {
      logger.error(`AI Classifier proxy error: ${err.message}`);
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'AI Classifier is currently unavailable',
        service: 'ai',
      });
    },
  })
);

/**
 * Blueprint Engine Proxy
 * Routes: /blueprints/*
 */
app.use('/blueprints',
  circuitBreaker('blueprints'),
  createProxyMiddleware({
    target: SERVICES.blueprints.url,
    changeOrigin: true,
    pathRewrite: {
      '^/blueprints': '/api/blueprints',
    },
    timeout: SERVICES.blueprints.timeout,
    onProxyReq: (proxyReq, req) => {
      logger.debug(`Proxying to Blueprint Engine: ${req.method} ${req.path}`);
    },
    onError: (err, req, res) => {
      logger.error(`Blueprint Engine proxy error: ${err.message}`);
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Blueprint Engine is currently unavailable',
        service: 'blueprints',
      });
    },
  })
);

// ============================================================================
// AGGREGATE ROUTES
// ============================================================================

/**
 * Aggregate data from multiple services
 * Example: /aggregate/application/:id - get app + capabilities + alternatives
 */
app.use('/aggregate', aggregateRoutes);

// ============================================================================
// TRANSFORM ROUTES
// ============================================================================

/**
 * Protocol transformation (REST ↔ GraphQL)
 */
app.use('/transform', transformRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    hint: 'Check the API documentation at /',
  });
});

// Global error handler
app.use(errorHandler);

// ============================================================================
// START SERVER
// ============================================================================

const server = app.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on port ${PORT}`);
  logger.info(`📊 Environment: ${NODE_ENV}`);
  logger.info(`🔗 Services configured: ${Object.keys(SERVICES).join(', ')}`);
  logger.info(`📡 Proxying requests to microservices`);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully...`);

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
