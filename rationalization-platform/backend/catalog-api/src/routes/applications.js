/**
 * Applications REST API routes
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * GET /api/applications
 * List applications with filtering and pagination
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('type').optional().isIn(['service', 'library', 'plugin', 'application', 'api', 'framework', 'tool']),
    query('source').optional(),
    query('tags').optional(),
    query('verified').optional().isBoolean().toBoolean(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid query parameters', errors.array());
    }

    const {
      page = 1,
      limit = 20,
      type,
      source,
      tags,
      verified,
      search,
      orderBy = 'stars',
      orderDirection = 'DESC',
    } = req.query;

    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions = ['is_active = true'];
    const params = [];
    let paramIndex = 1;

    if (type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(type);
    }

    if (source) {
      conditions.push(`source = $${paramIndex++}`);
      params.push(source);
    }

    if (verified !== undefined) {
      conditions.push(`is_verified = $${paramIndex++}`);
      params.push(verified);
    }

    if (tags) {
      const tagArray = tags.split(',');
      conditions.push(`tags @> $${paramIndex++}`);
      params.push(tagArray);
    }

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Validate orderBy column
    const validOrderColumns = ['name', 'stars', 'downloads', 'created_at', 'updated_at'];
    const safeOrderBy = validOrderColumns.includes(orderBy) ? orderBy : 'stars';
    const safeOrderDirection = orderDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM applications WHERE ${whereClause}`;
    const countResult = await req.db.postgres.one(countQuery, params);
    const totalCount = parseInt(countResult.count);

    // Get applications
    const query = `
      SELECT
        id, name, slug, description, type, source, source_url,
        homepage_url, documentation_url, repository_url, license,
        author, maintainers, tags, version, latest_version,
        stars, downloads, forks, issues_count, contributors_count,
        is_active, is_verified, last_updated_at, last_commit_at,
        created_at, updated_at
      FROM applications
      WHERE ${whereClause}
      ORDER BY ${safeOrderBy} ${safeOrderDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const applications = await req.db.postgres.any(query, params);

    res.json({
      data: applications,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPreviousPage: page > 1,
      },
    });
  })
);

/**
 * GET /api/applications/:id
 * Get single application by ID
 */
router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid application ID', errors.array());
    }

    const { id } = req.params;

    // Try cache first
    const cacheKey = `app:${id}`;
    const cached = await req.db.redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Get application
    const application = await req.db.postgres.oneOrNone(
      `SELECT * FROM applications WHERE id = $1`,
      [id]
    );

    if (!application) {
      throw new NotFoundError('Application');
    }

    // Get capabilities
    const capabilities = await req.db.postgres.any(
      `
      SELECT c.*, ac.confidence, ac.verified
      FROM capabilities c
      JOIN application_capabilities ac ON c.id = ac.capability_id
      WHERE ac.application_id = $1
      `,
      [id]
    );

    // Get dependencies
    const dependencies = await req.db.postgres.any(
      `
      SELECT a.*, d.version_constraint, d.dependency_type, d.is_required
      FROM applications a
      JOIN dependencies d ON a.id = d.depends_on_id
      WHERE d.application_id = $1
      `,
      [id]
    );

    const result = {
      ...application,
      capabilities,
      dependencies,
    };

    // Cache for 5 minutes
    await req.db.redis.setex(cacheKey, 300, JSON.stringify(result));

    res.json(result);
  })
);

/**
 * POST /api/applications
 * Create new application
 */
router.post(
  '/',
  strictRateLimiter,
  [
    body('name').notEmpty().trim().isLength({ min: 1, max: 255 }),
    body('slug').notEmpty().trim().matches(/^[a-z0-9-]+$/),
    body('description').optional().trim(),
    body('type').isIn(['service', 'library', 'plugin', 'application', 'api', 'framework', 'tool']),
    body('source').isIn(['github', 'npm', 'wordpress', 'google-play', 'maven', 'pypi', 'api']),
    body('sourceUrl').notEmpty().isURL(),
    body('homepageUrl').optional().isURL(),
    body('documentationUrl').optional().isURL(),
    body('repositoryUrl').optional().isURL(),
    body('license').optional().trim(),
    body('author').optional().trim(),
    body('tags').optional().isArray(),
    body('version').optional().trim(),
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
      type,
      source,
      sourceUrl,
      homepageUrl,
      documentationUrl,
      repositoryUrl,
      license,
      author,
      tags = [],
      version,
    } = req.body;

    // Check if slug already exists
    const existing = await req.db.postgres.oneOrNone(
      'SELECT id FROM applications WHERE slug = $1',
      [slug]
    );

    if (existing) {
      throw new ValidationError('Application with this slug already exists');
    }

    // Insert application
    const application = await req.db.postgres.one(
      `
      INSERT INTO applications (
        name, slug, description, type, source, source_url,
        homepage_url, documentation_url, repository_url,
        license, author, tags, version
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        name,
        slug,
        description,
        type,
        source,
        sourceUrl,
        homepageUrl,
        documentationUrl,
        repositoryUrl,
        license,
        author,
        tags,
        version,
      ]
    );

    // Invalidate cache
    await req.db.invalidateCache('apps:*');

    res.status(201).json(application);
  })
);

/**
 * PUT /api/applications/:id
 * Update application
 */
router.put(
  '/:id',
  strictRateLimiter,
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().trim(),
    body('homepageUrl').optional().isURL(),
    body('documentationUrl').optional().isURL(),
    body('license').optional().trim(),
    body('tags').optional().isArray(),
    body('version').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid input', errors.array());
    }

    const { id } = req.params;
    const updates = req.body;

    // Build UPDATE query dynamically
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'name',
      'description',
      'homepage_url',
      'documentation_url',
      'license',
      'tags',
      'version',
      'is_active',
    ];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (allowedFields.includes(snakeKey)) {
        fields.push(`${snakeKey} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    values.push(id);

    const query = `
      UPDATE applications
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const application = await req.db.postgres.oneOrNone(query, values);

    if (!application) {
      throw new NotFoundError('Application');
    }

    // Invalidate cache
    await req.db.redis.del(`app:${id}`);
    await req.db.invalidateCache('apps:*');

    res.json(application);
  })
);

/**
 * DELETE /api/applications/:id
 * Delete application
 */
router.delete(
  '/:id',
  strictRateLimiter,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid application ID', errors.array());
    }

    const { id } = req.params;

    const result = await req.db.postgres.result(
      'DELETE FROM applications WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Application');
    }

    // Invalidate cache
    await req.db.redis.del(`app:${id}`);
    await req.db.invalidateCache('apps:*');

    res.status(204).send();
  })
);

/**
 * GET /api/applications/:id/alternatives
 * Find alternative applications
 */
router.get(
  '/:id/alternatives',
  [
    param('id').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 20 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    const alternatives = await req.db.postgres.any(
      `
      SELECT
        a.*,
        alt.similarity_score,
        alt.use_case_overlap,
        alt.feature_overlap,
        alt.comparison_notes
      FROM alternatives alt
      JOIN applications a ON a.id = alt.alternative_id
      WHERE alt.application_id = $1
      ORDER BY alt.similarity_score DESC
      LIMIT $2
      `,
      [id, limit]
    );

    res.json(alternatives);
  })
);

/**
 * GET /api/applications/:id/compatibility
 * Check compatibility with other applications
 */
router.get(
  '/:id/compatibility',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const compatibility = await req.db.postgres.any(
      `
      SELECT
        CASE
          WHEN c.application_a_id = $1 THEN c.application_b_id
          ELSE c.application_a_id
        END as other_app_id,
        a.name as other_app_name,
        c.status,
        c.compatibility_score,
        c.tested_at,
        c.known_issues,
        c.workarounds
      FROM compatibility c
      JOIN applications a ON a.id = (
        CASE
          WHEN c.application_a_id = $1 THEN c.application_b_id
          ELSE c.application_a_id
        END
      )
      WHERE c.application_a_id = $1 OR c.application_b_id = $1
      ORDER BY c.compatibility_score DESC NULLS LAST
      `,
      [id]
    );

    res.json(compatibility);
  })
);

export default router;
