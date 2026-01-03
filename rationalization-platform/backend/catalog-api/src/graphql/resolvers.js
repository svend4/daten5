/**
 * GraphQL Resolvers
 * Implementation of all GraphQL queries and mutations
 */

import { GraphQLError } from 'graphql';

export const resolvers = {
  // ==========================================================================
  // QUERIES
  // ==========================================================================

  Query: {
    // ------------------------------------------------------------------------
    // Applications
    // ------------------------------------------------------------------------

    application: async (_, { id }, { db }) => {
      const app = await db.postgres.oneOrNone(
        'SELECT * FROM applications WHERE id = $1',
        [id]
      );

      if (!app) {
        throw new GraphQLError('Application not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return app;
    },

    applicationBySlug: async (_, { slug }, { db }) => {
      return await db.postgres.oneOrNone(
        'SELECT * FROM applications WHERE slug = $1',
        [slug]
      );
    },

    applications: async (_, { first, after, filter, orderBy, orderDirection }, { db }) => {
      const limit = first || 20;
      const offset = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;

      // Build WHERE clause
      const conditions = ['is_active = true'];
      const params = [];
      let paramIndex = 1;

      if (filter) {
        if (filter.type && filter.type.length > 0) {
          conditions.push(`type = ANY($${paramIndex++})`);
          params.push(filter.type.map(t => t.toLowerCase()));
        }

        if (filter.source && filter.source.length > 0) {
          conditions.push(`source = ANY($${paramIndex++})`);
          params.push(filter.source.map(s => s.toLowerCase()));
        }

        if (filter.tags && filter.tags.length > 0) {
          conditions.push(`tags && $${paramIndex++}`);
          params.push(filter.tags);
        }

        if (filter.minStars !== undefined) {
          conditions.push(`stars >= $${paramIndex++}`);
          params.push(filter.minStars);
        }

        if (filter.isVerified !== undefined) {
          conditions.push(`is_verified = $${paramIndex++}`);
          params.push(filter.isVerified);
        }
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await db.postgres.one(
        `SELECT COUNT(*) FROM applications WHERE ${whereClause}`,
        params
      );
      const totalCount = parseInt(countResult.count);

      // Get applications
      const safeOrderBy = orderBy || 'stars';
      const safeOrderDirection = orderDirection || 'DESC';

      const query = `
        SELECT * FROM applications
        WHERE ${whereClause}
        ORDER BY ${safeOrderBy} ${safeOrderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const applications = await db.postgres.any(query, params);

      const edges = applications.map((app, index) => ({
        cursor: Buffer.from((offset + index).toString()).toString('base64'),
        node: app,
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + applications.length < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
          totalCount,
        },
      };
    },

    searchApplications: async (_, { query, limit, threshold }, { db }) => {
      // Simple text search (semantic search would require embeddings)
      const applications = await db.postgres.any(
        `
        SELECT * FROM applications
        WHERE is_active = true
          AND (name ILIKE $1 OR description ILIKE $1)
        ORDER BY stars DESC
        LIMIT $2
        `,
        [`%${query}%`, limit || 10]
      );

      return applications;
    },

    findAlternatives: async (_, { applicationId, limit }, { db }) => {
      const alternatives = await db.postgres.any(
        `
        SELECT alt.*, a.*
        FROM alternatives alt
        JOIN applications a ON a.id = alt.alternative_id
        WHERE alt.application_id = $1
        ORDER BY alt.similarity_score DESC
        LIMIT $2
        `,
        [applicationId, limit || 5]
      );

      return alternatives;
    },

    // ------------------------------------------------------------------------
    // Capabilities
    // ------------------------------------------------------------------------

    capability: async (_, { id }, { db }) => {
      return await db.postgres.oneOrNone(
        'SELECT * FROM capabilities WHERE id = $1',
        [id]
      );
    },

    capabilities: async (_, { category }, { db }) => {
      if (category) {
        return await db.postgres.any(
          'SELECT * FROM capabilities WHERE category = $1 ORDER BY name',
          [category]
        );
      }

      return await db.postgres.any(
        'SELECT * FROM capabilities ORDER BY category, name'
      );
    },

    capabilityTree: async (_, __, { db }) => {
      return await db.postgres.any(
        'SELECT * FROM capabilities ORDER BY category, name'
      );
    },

    // ------------------------------------------------------------------------
    // Blueprints
    // ------------------------------------------------------------------------

    blueprint: async (_, { id }, { db }) => {
      return await db.postgres.oneOrNone(
        'SELECT * FROM blueprints WHERE id = $1',
        [id]
      );
    },

    blueprintBySlug: async (_, { slug }, { db }) => {
      return await db.postgres.oneOrNone(
        'SELECT * FROM blueprints WHERE slug = $1',
        [slug]
      );
    },

    blueprints: async (_, { category, tags, limit, offset }, { db }) => {
      const conditions = ['is_public = true'];
      const params = [];
      let paramIndex = 1;

      if (category) {
        conditions.push(`category = $${paramIndex++}`);
        params.push(category);
      }

      if (tags && tags.length > 0) {
        conditions.push(`tags && $${paramIndex++}`);
        params.push(tags);
      }

      params.push(limit || 20, offset || 0);

      const query = `
        SELECT * FROM blueprints
        WHERE ${conditions.join(' AND ')}
        ORDER BY rating_average DESC NULLS LAST
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      return await db.postgres.any(query, params);
    },

    // ------------------------------------------------------------------------
    // Statistics
    // ------------------------------------------------------------------------

    statistics: async (_, __, { db }) => {
      const stats = {
        totalApplications: 0,
        totalBlueprints: 0,
        totalCapabilities: 0,
        applicationsPerType: {},
        applicationsPerSource: {},
        topCapabilities: [],
        topTags: [],
      };

      // Get counts
      const counts = await db.postgres.one(`
        SELECT
          (SELECT COUNT(*) FROM applications WHERE is_active = true) as apps,
          (SELECT COUNT(*) FROM blueprints WHERE is_public = true) as blueprints,
          (SELECT COUNT(*) FROM capabilities) as capabilities
      `);

      stats.totalApplications = parseInt(counts.apps);
      stats.totalBlueprints = parseInt(counts.blueprints);
      stats.totalCapabilities = parseInt(counts.capabilities);

      // Get applications per type
      const typeStats = await db.postgres.any(`
        SELECT type, COUNT(*) as count
        FROM applications
        WHERE is_active = true
        GROUP BY type
        ORDER BY count DESC
      `);

      stats.applicationsPerType = typeStats.reduce((acc, { type, count }) => {
        acc[type] = parseInt(count);
        return acc;
      }, {});

      // Get applications per source
      const sourceStats = await db.postgres.any(`
        SELECT source, COUNT(*) as count
        FROM applications
        WHERE is_active = true
        GROUP BY source
        ORDER BY count DESC
      `);

      stats.applicationsPerSource = sourceStats.reduce((acc, { source, count }) => {
        acc[source] = parseInt(count);
        return acc;
      }, {});

      return stats;
    },
  },

  // ==========================================================================
  // MUTATIONS
  // ==========================================================================

  Mutation: {
    createApplication: async (_, { input }, { db }) => {
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
      } = input;

      // Check if slug exists
      const existing = await db.postgres.oneOrNone(
        'SELECT id FROM applications WHERE slug = $1',
        [slug]
      );

      if (existing) {
        throw new GraphQLError('Application with this slug already exists', {
          extensions: { code: 'DUPLICATE_ENTRY' },
        });
      }

      const application = await db.postgres.one(
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
          type.toLowerCase(),
          source.toLowerCase(),
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

      return application;
    },

    updateApplication: async (_, { id, input }, { db }) => {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      const fieldMap = {
        name: 'name',
        description: 'description',
        homepageUrl: 'homepage_url',
        documentationUrl: 'documentation_url',
        license: 'license',
        tags: 'tags',
        version: 'version',
        isActive: 'is_active',
      };

      for (const [key, value] of Object.entries(input)) {
        const dbField = fieldMap[key];
        if (dbField && value !== undefined) {
          fields.push(`${dbField} = $${paramIndex++}`);
          values.push(value);
        }
      }

      if (fields.length === 0) {
        throw new GraphQLError('No valid fields to update', {
          extensions: { code: 'VALIDATION_ERROR' },
        });
      }

      values.push(id);

      const query = `
        UPDATE applications
        SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const application = await db.postgres.oneOrNone(query, values);

      if (!application) {
        throw new GraphQLError('Application not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Invalidate cache
      await db.redis.del(`app:${id}`);

      return application;
    },

    deleteApplication: async (_, { id }, { db }) => {
      const result = await db.postgres.result(
        'DELETE FROM applications WHERE id = $1',
        [id]
      );

      return result.rowCount > 0;
    },

    createBlueprint: async (_, { input }, { db }) => {
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
      } = input;

      const blueprint = await db.postgres.one(
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
          difficultyLevel?.toLowerCase(),
          estimatedCostMonthly,
        ]
      );

      return blueprint;
    },
  },

  // ==========================================================================
  // FIELD RESOLVERS
  // ==========================================================================

  Application: {
    capabilities: async (parent, _, { db }) => {
      return await db.postgres.any(
        `
        SELECT c.*, ac.confidence, ac.verified
        FROM capabilities c
        JOIN application_capabilities ac ON c.id = ac.capability_id
        WHERE ac.application_id = $1
        `,
        [parent.id]
      );
    },

    dependencies: async (parent, _, { db }) => {
      return await db.postgres.any(
        `
        SELECT * FROM dependencies
        WHERE application_id = $1
        `,
        [parent.id]
      );
    },

    apiEndpoints: async (parent, _, { db }) => {
      return await db.postgres.any(
        'SELECT * FROM api_endpoints WHERE application_id = $1',
        [parent.id]
      );
    },
  },

  Blueprint: {
    applications: async (parent, _, { db }) => {
      return await db.postgres.any(
        `
        SELECT a.*, ba.configuration, ba.execution_order
        FROM applications a
        JOIN blueprint_applications ba ON a.id = ba.application_id
        WHERE ba.blueprint_id = $1
        ORDER BY ba.execution_order
        `,
        [parent.id]
      );
    },

    reviews: async (parent, _, { db }) => {
      return await db.postgres.any(
        `
        SELECT * FROM reviews
        WHERE target_type = 'blueprint' AND target_id = $1
        ORDER BY created_at DESC
        LIMIT 10
        `,
        [parent.id]
      );
    },
  },

  Capability: {
    applications: async (parent, _, { db }) => {
      return await db.postgres.any(
        `
        SELECT a.*, ac.confidence
        FROM applications a
        JOIN application_capabilities ac ON a.id = ac.application_id
        WHERE ac.capability_id = $1
        ORDER BY a.stars DESC
        LIMIT 50
        `,
        [parent.id]
      );
    },

    children: async (parent, _, { db }) => {
      return await db.postgres.any(
        'SELECT * FROM capabilities WHERE parent_id = $1',
        [parent.id]
      );
    },
  },
};
