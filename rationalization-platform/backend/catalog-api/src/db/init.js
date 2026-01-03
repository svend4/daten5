/**
 * Database initialization
 * Sets up connections to PostgreSQL, Neo4j, Redis, and Elasticsearch
 */

import pgPromise from 'pg-promise';
import neo4j from 'neo4j-driver';
import Redis from 'ioredis';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import logger from '../utils/logger.js';

const pgp = pgPromise({});

/**
 * Initialize all database connections
 * @returns {Object} Database connection instances
 */
export async function initDatabase() {
  const connections = {};

  try {
    // =========================================================================
    // POSTGRESQL
    // =========================================================================
    logger.info('Connecting to PostgreSQL...');

    const postgresConfig = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'rationalization',
      user: process.env.POSTGRES_USER || 'admin',
      password: process.env.POSTGRES_PASSWORD,
      max: 20, // connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    connections.postgres = pgp(postgresConfig);

    // Test connection
    await connections.postgres.connect();
    logger.info('✓ PostgreSQL connected');

    // =========================================================================
    // NEO4J
    // =========================================================================
    logger.info('Connecting to Neo4j...');

    const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const neo4jUser = process.env.NEO4J_USER || 'neo4j';
    const neo4jPassword = process.env.NEO4J_PASSWORD;

    connections.neo4j = neo4j.driver(
      neo4jUri,
      neo4j.auth.basic(neo4jUser, neo4jPassword),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 60000,
      }
    );

    // Test connection
    const session = connections.neo4j.session();
    await session.run('RETURN 1');
    await session.close();
    logger.info('✓ Neo4j connected');

    // =========================================================================
    // REDIS
    // =========================================================================
    logger.info('Connecting to Redis...');

    connections.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    // Test connection
    await connections.redis.ping();
    logger.info('✓ Redis connected');

    // =========================================================================
    // ELASTICSEARCH
    // =========================================================================
    logger.info('Connecting to Elasticsearch...');

    connections.elasticsearch = new ElasticsearchClient({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      maxRetries: 3,
      requestTimeout: 60000,
    });

    // Test connection
    await connections.elasticsearch.ping();
    logger.info('✓ Elasticsearch connected');

    // =========================================================================
    // DATABASE HELPERS
    // =========================================================================

    /**
     * Execute PostgreSQL query with caching
     */
    connections.queryWithCache = async (cacheKey, query, params = [], ttl = 60) => {
      // Try cache first
      const cached = await connections.redis.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit: ${cacheKey}`);
        return JSON.parse(cached);
      }

      // Execute query
      const result = await connections.postgres.any(query, params);

      // Store in cache
      await connections.redis.setex(cacheKey, ttl, JSON.stringify(result));

      return result;
    };

    /**
     * Execute Neo4j query
     */
    connections.neo4jQuery = async (cypher, params = {}) => {
      const session = connections.neo4j.session();
      try {
        const result = await session.run(cypher, params);
        return result.records.map(record => record.toObject());
      } finally {
        await session.close();
      }
    };

    /**
     * Semantic search in Elasticsearch
     */
    connections.semanticSearch = async (index, query, options = {}) => {
      const { size = 10, from = 0, filters = {} } = options;

      const searchQuery = {
        index,
        body: {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query,
                    fields: ['name^3', 'description^2', 'tags'],
                    type: 'best_fields',
                    fuzziness: 'AUTO',
                  },
                },
              ],
              filter: Object.entries(filters).map(([field, value]) => ({
                term: { [field]: value },
              })),
            },
          },
          size,
          from,
        },
      };

      const result = await connections.elasticsearch.search(searchQuery);
      return result.hits.hits.map(hit => ({
        ...hit._source,
        _score: hit._score,
      }));
    };

    /**
     * Invalidate cache pattern
     */
    connections.invalidateCache = async (pattern) => {
      const keys = await connections.redis.keys(pattern);
      if (keys.length > 0) {
        await connections.redis.del(...keys);
        logger.debug(`Invalidated ${keys.length} cache keys matching ${pattern}`);
      }
    };

    return connections;

  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Close all database connections
 */
export async function closeDatabase(connections) {
  logger.info('Closing database connections...');

  try {
    if (connections.postgres) {
      await connections.postgres.$pool.end();
      logger.info('✓ PostgreSQL closed');
    }

    if (connections.neo4j) {
      await connections.neo4j.close();
      logger.info('✓ Neo4j closed');
    }

    if (connections.redis) {
      await connections.redis.quit();
      logger.info('✓ Redis closed');
    }

    if (connections.elasticsearch) {
      await connections.elasticsearch.close();
      logger.info('✓ Elasticsearch closed');
    }
  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
}
