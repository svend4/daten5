/**
 * Health Check Routes
 */

import express from 'express';
import axios from 'axios';
import { getCircuitStatuses } from '../middleware/circuitBreaker.js';
import { getCacheStats } from '../middleware/cache.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const SERVICES = {
  catalog: process.env.CATALOG_API_URL || 'http://catalog-api:3000',
  ai: process.env.AI_CLASSIFIER_URL || 'http://ai-classifier:8001',
};

/**
 * GET /health
 * Basic health check
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

/**
 * GET /health/detailed
 * Detailed health check with all services
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {},
    circuitBreakers: getCircuitStatuses(),
  };

  // Check each backend service
  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      health.services[name] = {
        status: 'ok',
        responseTime: response.headers['x-response-time'] || 'N/A',
      };
    } catch (error) {
      health.services[name] = {
        status: 'error',
        error: error.message,
      };
      health.status = 'degraded';
    }
  }

  // Add cache stats
  try {
    health.cache = await getCacheStats();
  } catch (error) {
    health.cache = { error: error.message };
  }

  res.json(health);
});

export { router as healthRouter };
