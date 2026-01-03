/**
 * Metrics Middleware
 * Collects and exposes metrics for Prometheus monitoring
 */

import promClient from 'prom-client';
import { logger } from '../utils/logger.js';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// ============================================================================
// CUSTOM METRICS
// ============================================================================

// HTTP request duration histogram
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// HTTP request counter
const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// HTTP request size
const httpRequestSize = new promClient.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// HTTP response size
const httpResponseSize = new promClient.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// Circuit breaker state
const circuitBreakerState = new promClient.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)',
  labelNames: ['service'],
  registers: [register],
});

// Cache hit ratio
const cacheHits = new promClient.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_key_prefix'],
  registers: [register],
});

const cacheMisses = new promClient.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_key_prefix'],
  registers: [register],
});

// Active connections
const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register],
});

// Service health status
const serviceHealth = new promClient.Gauge({
  name: 'service_health_status',
  help: 'Health status of backend services (1=healthy, 0=unhealthy)',
  labelNames: ['service'],
  registers: [register],
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Metrics collection middleware
 */
export function metricsMiddleware(req, res, next) {
  // Skip metrics collection for /metrics endpoint
  if (req.path === '/metrics') {
    return next();
  }

  // Track start time
  const startTime = Date.now();

  // Increment active connections
  activeConnections.inc();

  // Track request size
  const requestSize = parseInt(req.headers['content-length'] || '0');
  if (requestSize > 0) {
    httpRequestSize.observe({
      method: req.method,
      route: getRoute(req.path),
    }, requestSize);
  }

  // Intercept response
  const originalSend = res.send;
  res.send = function(data) {
    // Calculate duration
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds

    // Get route pattern
    const route = getRoute(req.path);

    // Record metrics
    httpRequestDuration.observe({
      method: req.method,
      route,
      status_code: res.statusCode,
    }, duration);

    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    // Track response size
    const responseSize = Buffer.byteLength(data || '');
    if (responseSize > 0) {
      httpResponseSize.observe({
        method: req.method,
        route,
        status_code: res.statusCode,
      }, responseSize);
    }

    // Track cache hits/misses
    const cacheStatus = res.get('X-Cache');
    if (cacheStatus === 'HIT') {
      cacheHits.inc({ cache_key_prefix: route });
    } else if (cacheStatus === 'MISS') {
      cacheMisses.inc({ cache_key_prefix: route });
    }

    // Decrement active connections
    activeConnections.dec();

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Normalize route path for metrics
 * /api/applications/123 -> /api/applications/:id
 */
function getRoute(path) {
  // Remove query string
  const cleanPath = path.split('?')[0];

  // Replace UUIDs with :id
  const normalized = cleanPath.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/:id'
  );

  // Replace numeric IDs
  return normalized.replace(/\/\d+/g, '/:id');
}

/**
 * Metrics endpoint for Prometheus scraping
 */
export async function metricsEndpoint(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Failed to generate metrics:', error);
    res.status(500).end('Failed to generate metrics');
  }
}

/**
 * Update circuit breaker metrics
 */
export function updateCircuitBreakerMetrics(service, state) {
  const stateValue = {
    'CLOSED': 0,
    'OPEN': 1,
    'HALF_OPEN': 2,
  }[state] || 0;

  circuitBreakerState.set({ service }, stateValue);
}

/**
 * Update service health metrics
 */
export function updateServiceHealth(service, isHealthy) {
  serviceHealth.set({ service }, isHealthy ? 1 : 0);
}

/**
 * Get current metrics (for debugging)
 */
export async function getCurrentMetrics() {
  return await register.getMetricsAsJSON();
}

export { register };
