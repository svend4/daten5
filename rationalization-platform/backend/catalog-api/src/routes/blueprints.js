/**
 * Blueprints REST API routes
 */

import express from 'express';
import { param, body, query, validationResult } from 'express-validator';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/blueprints
 * List blueprints with filtering
 */
router.get(
  '/',
  [
    query('category').optional(),
    query('tags').optional(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const {
      category,
      tags,
      limit = 20,
      offset = 0,
      orderBy = 'rating_average',
    } = req.query;

    const conditions = ['is_public = true'];
    const params = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (tags) {
      const tagArray = tags.split(',');
      conditions.push(`tags @> $${paramIndex++}`);
      params.push(tagArray);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM blueprints WHERE ${whereClause}`;
    const countResult = await req.db.postgres.one(countQuery, params);
    const totalCount = parseInt(countResult.count);

    // Get blueprints
    const query = `
      SELECT
        id, name, slug, description, use_case, category, tags,
        is_public, is_verified, usage_count, success_rate,
        average_setup_time, rating_average, rating_count,
        estimated_cost_monthly, required_skills, difficulty_level,
        created_at, updated_at
      FROM blueprints
      WHERE ${whereClause}
      ORDER BY ${orderBy} DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const blueprints = await req.db.postgres.any(query, params);

    res.json({
      data: blueprints,
      pagination: {
        limit,
        offset,
        totalCount,
      },
    });
  })
);

/**
 * GET /api/blueprints/:id
 * Get blueprint by ID with full details
 */
router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const blueprint = await req.db.postgres.oneOrNone(
      'SELECT * FROM blueprints WHERE id = $1',
      [id]
    );

    if (!blueprint) {
      throw new NotFoundError('Blueprint');
    }

    // Get applications used in this blueprint
    const applications = await req.db.postgres.any(
      `
      SELECT a.*, ba.configuration, ba.execution_order, ba.is_required
      FROM applications a
      JOIN blueprint_applications ba ON a.id = ba.application_id
      WHERE ba.blueprint_id = $1
      ORDER BY ba.execution_order
      `,
      [id]
    );

    // Get reviews
    const reviews = await req.db.postgres.any(
      `
      SELECT * FROM reviews
      WHERE target_type = 'blueprint' AND target_id = $1
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [id]
    );

    res.json({
      ...blueprint,
      applications,
      reviews,
    });
  })
);

/**
 * POST /api/blueprints
 * Create new blueprint
 */
router.post(
  '/',
  [
    body('name').notEmpty().trim(),
    body('slug').notEmpty().matches(/^[a-z0-9-]+$/),
    body('description').optional(),
    body('useCase').notEmpty(),
    body('category').optional(),
    body('tags').optional().isArray(),
    body('components').isObject(),
    body('requiredSkills').optional().isArray(),
    body('difficultyLevel').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid input', errors.array());
    }

    const {
      name,
      slug,
      description,
      useCase,
      category,
      tags = [],
      components,
      workflow,
      requiredSkills = [],
      difficultyLevel,
      estimatedCostMonthly,
    } = req.body;

    // Check if slug exists
    const existing = await req.db.postgres.oneOrNone(
      'SELECT id FROM blueprints WHERE slug = $1',
      [slug]
    );

    if (existing) {
      throw new ValidationError('Blueprint with this slug already exists');
    }

    const blueprint = await req.db.postgres.one(
      `
      INSERT INTO blueprints (
        name, slug, description, use_case, category, tags,
        components, workflow, required_skills, difficulty_level,
        estimated_cost_monthly
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        name,
        slug,
        description,
        useCase,
        category,
        tags,
        components,
        workflow,
        requiredSkills,
        difficultyLevel,
        estimatedCostMonthly,
      ]
    );

    res.status(201).json(blueprint);
  })
);

/**
 * GET /api/blueprints/recommend
 * Recommend blueprints based on natural language description
 */
router.get(
  '/recommend',
  [query('query').notEmpty()],
  asyncHandler(async (req, res) => {
    const { query, limit = 5 } = req.query;

    // Use Elasticsearch for semantic search
    const results = await req.db.semanticSearch('blueprints', query, {
      size: limit,
      filters: { is_public: true },
    });

    res.json(results);
  })
);

export default router;
