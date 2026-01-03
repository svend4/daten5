/**
 * Health check routes
 */

import express from 'express';

const router = express.Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * GET /api/health/detailed
 * Detailed health check with database status
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {},
  };

  try {
    // Check PostgreSQL
    try {
      await req.db.postgres.one('SELECT 1 as result');
      health.services.postgres = { status: 'ok' };
    } catch (error) {
      health.services.postgres = { status: 'error', message: error.message };
      health.status = 'degraded';
    }

    // Check Neo4j
    try {
      await req.db.neo4jQuery('RETURN 1 as result');
      health.services.neo4j = { status: 'ok' };
    } catch (error) {
      health.services.neo4j = { status: 'error', message: error.message };
      health.status = 'degraded';
    }

    // Check Redis
    try {
      await req.db.redis.ping();
      health.services.redis = { status: 'ok' };
    } catch (error) {
      health.services.redis = { status: 'error', message: error.message };
      health.status = 'degraded';
    }

    // Check Elasticsearch
    try {
      await req.db.elasticsearch.ping();
      health.services.elasticsearch = { status: 'ok' };
    } catch (error) {
      health.services.elasticsearch = { status: 'error', message: error.message };
      health.status = 'degraded';
    }

    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;
