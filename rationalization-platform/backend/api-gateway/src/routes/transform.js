/**
 * Transform Routes
 * Protocol transformation between REST and GraphQL
 */

import express from 'express';
import axios from 'axios';
import { logger } from '../utils/logger.js';

const router = express.Router();

const CATALOG_URL = process.env.CATALOG_API_URL || 'http://catalog-api:3000';

/**
 * POST /transform/rest-to-graphql
 * Convert REST request to GraphQL query
 */
router.post('/rest-to-graphql', async (req, res) => {
  try {
    const { endpoint, method = 'GET', params = {} } = req.body;

    // Map common REST endpoints to GraphQL queries
    const query = mapRestToGraphQL(endpoint, method, params);

    if (!query) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Unable to convert REST endpoint to GraphQL',
      });
    }

    // Execute GraphQL query
    const response = await axios.post(`${CATALOG_URL}/graphql`, {
      query: query.query,
      variables: query.variables,
    });

    res.json(response.data);

  } catch (error) {
    logger.error('REST to GraphQL transform error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to transform request',
    });
  }
});

/**
 * Map REST endpoints to GraphQL queries
 */
function mapRestToGraphQL(endpoint, method, params) {
  // Simple mapping for common endpoints
  if (endpoint === '/applications' && method === 'GET') {
    return {
      query: `
        query GetApplications($first: Int, $filter: SearchFilter) {
          applications(first: $first, filter: $filter) {
            edges {
              node {
                id
                name
                description
                type
                stars
              }
            }
          }
        }
      `,
      variables: {
        first: params.limit || 20,
        filter: params.filter || null,
      },
    };
  }

  if (endpoint.match(/\/applications\/[^/]+$/) && method === 'GET') {
    const id = endpoint.split('/').pop();
    return {
      query: `
        query GetApplication($id: UUID!) {
          application(id: $id) {
            id
            name
            description
            type
            source
            capabilities {
              name
              category
            }
          }
        }
      `,
      variables: { id },
    };
  }

  return null;
}

export { router as transformRoutes };
