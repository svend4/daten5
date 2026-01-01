/**
 * Search REST API routes
 */

import express from 'express';
import { query, validationResult } from 'express-validator';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/search
 * Global search across all entities
 */
router.get(
  '/',
  [
    query('q').notEmpty().trim(),
    query('type').optional().isIn(['applications', 'blueprints', 'capabilities', 'all']),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid search parameters', errors.array());
    }

    const { q: searchQuery, type = 'all', limit = 20 } = req.query;

    const results = {
      applications: [],
      blueprints: [],
      capabilities: [],
    };

    // Search applications
    if (type === 'all' || type === 'applications') {
      results.applications = await req.db.postgres.any(
        `
        SELECT
          id, name, slug, description, type, source,
          stars, downloads, tags
        FROM applications
        WHERE
          is_active = true AND
          (
            name ILIKE $1 OR
            description ILIKE $1 OR
            $2 = ANY(tags)
          )
        ORDER BY stars DESC
        LIMIT $3
        `,
        [`%${searchQuery}%`, searchQuery, limit]
      );
    }

    // Search blueprints
    if (type === 'all' || type === 'blueprints') {
      results.blueprints = await req.db.postgres.any(
        `
        SELECT
          id, name, slug, description, use_case, category,
          rating_average, usage_count, tags
        FROM blueprints
        WHERE
          is_public = true AND
          (
            name ILIKE $1 OR
            description ILIKE $1 OR
            use_case ILIKE $1 OR
            $2 = ANY(tags)
          )
        ORDER BY rating_average DESC NULLS LAST
        LIMIT $3
        `,
        [`%${searchQuery}%`, searchQuery, limit]
      );
    }

    // Search capabilities
    if (type === 'all' || type === 'capabilities') {
      results.capabilities = await req.db.postgres.any(
        `
        SELECT id, name, slug, description, category
        FROM capabilities
        WHERE
          name ILIKE $1 OR
          description ILIKE $1 OR
          category ILIKE $1
        ORDER BY name
        LIMIT $2
        `,
        [`%${searchQuery}%`, limit]
      );
    }

    // Log search query
    await req.db.postgres.none(
      `
      INSERT INTO search_queries (query, results_count)
      VALUES ($1, $2)
      `,
      [
        searchQuery,
        results.applications.length +
          results.blueprints.length +
          results.capabilities.length,
      ]
    );

    res.json(results);
  })
);

/**
 * GET /api/search/semantic
 * Semantic search using vector embeddings
 */
router.get(
  '/semantic',
  [
    query('q').notEmpty(),
    query('threshold').optional().isFloat({ min: 0, max: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { q: searchQuery, threshold = 0.7, limit = 10 } = req.query;

    // This would require generating embeddings for the search query
    // using OpenAI API and then searching in the vector database
    // For now, return a placeholder

    res.json({
      message: 'Semantic search requires AI service integration',
      query: searchQuery,
      // Implementation would call AI classifier service to generate embeddings
      // then use semantic_search_applications() function from schema.sql
    });
  })
);

/**
 * GET /api/search/suggestions
 * Get search suggestions (autocomplete)
 */
router.get(
  '/suggestions',
  [
    query('q').notEmpty().isLength({ min: 2 }),
    query('limit').optional().isInt({ min: 1, max: 10 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { q: searchQuery, limit = 5 } = req.query;

    // Get suggestions from application names and capabilities
    const suggestions = await req.db.postgres.any(
      `
      (
        SELECT DISTINCT name as suggestion, 'application' as type
        FROM applications
        WHERE name ILIKE $1 AND is_active = true
        LIMIT $2
      )
      UNION ALL
      (
        SELECT DISTINCT name as suggestion, 'capability' as type
        FROM capabilities
        WHERE name ILIKE $1
        LIMIT $2
      )
      LIMIT $2
      `,
      [`${searchQuery}%`, limit]
    );

    res.json(suggestions);
  })
);

export default router;
