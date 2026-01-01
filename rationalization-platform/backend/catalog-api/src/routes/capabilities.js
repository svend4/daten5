/**
 * Capabilities REST API routes
 */

import express from 'express';
import { param, body, validationResult } from 'express-validator';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/capabilities
 * List all capabilities
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category } = req.query;

    const cacheKey = `capabilities:${category || 'all'}`;
    const cached = await req.db.redis.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    let query = 'SELECT * FROM capabilities';
    const params = [];

    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }

    query += ' ORDER BY category, name';

    const capabilities = await req.db.postgres.any(query, params);

    // Cache for 1 hour
    await req.db.redis.setex(cacheKey, 3600, JSON.stringify(capabilities));

    res.json(capabilities);
  })
);

/**
 * GET /api/capabilities/:id
 * Get capability by ID with applications
 */
router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const capability = await req.db.postgres.oneOrNone(
      'SELECT * FROM capabilities WHERE id = $1',
      [id]
    );

    if (!capability) {
      throw new NotFoundError('Capability');
    }

    // Get applications with this capability
    const applications = await req.db.postgres.any(
      `
      SELECT a.*, ac.confidence, ac.verified
      FROM applications a
      JOIN application_capabilities ac ON a.id = ac.application_id
      WHERE ac.capability_id = $1
      ORDER BY a.stars DESC
      LIMIT 50
      `,
      [id]
    );

    res.json({
      ...capability,
      applications,
    });
  })
);

/**
 * GET /api/capabilities/tree
 * Get hierarchical capability tree
 */
router.get(
  '/tree',
  asyncHandler(async (req, res) => {
    const cacheKey = 'capabilities:tree';
    const cached = await req.db.redis.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Get all capabilities
    const capabilities = await req.db.postgres.any(
      'SELECT * FROM capabilities ORDER BY category, name'
    );

    // Build tree structure
    const tree = {};

    capabilities.forEach(cap => {
      if (!tree[cap.category]) {
        tree[cap.category] = [];
      }
      tree[cap.category].push(cap);
    });

    // Cache for 1 hour
    await req.db.redis.setex(cacheKey, 3600, JSON.stringify(tree));

    res.json(tree);
  })
);

export default router;
