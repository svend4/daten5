/**
 * Aggregate Routes
 * Combine data from multiple microservices into single responses
 */

import express from 'express';
import axios from 'axios';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Service URLs
const CATALOG_URL = process.env.CATALOG_API_URL || 'http://catalog-api:3000';
const AI_URL = process.env.AI_CLASSIFIER_URL || 'http://ai-classifier:8001';

/**
 * GET /aggregate/application/:id
 * Get complete application data from multiple services
 * - Basic info from Catalog
 * - Capabilities
 * - Dependencies
 * - Alternatives
 * - Compatibility
 */
router.get('/application/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch data from multiple endpoints in parallel
    const [appResponse, capabilitiesResponse, dependenciesResponse, alternativesResponse] =
      await Promise.allSettled([
        axios.get(`${CATALOG_URL}/api/applications/${id}`),
        axios.get(`${CATALOG_URL}/api/applications/${id}/capabilities`).catch(() => ({ data: [] })),
        axios.get(`${CATALOG_URL}/api/applications/${id}/dependencies`).catch(() => ({ data: [] })),
        axios.get(`${CATALOG_URL}/api/applications/${id}/alternatives`).catch(() => ({ data: [] })),
      ]);

    // Check if main application fetch failed
    if (appResponse.status === 'rejected') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Application not found',
      });
    }

    const application = appResponse.value.data;

    // Aggregate the data
    const aggregated = {
      ...application,
      capabilities: capabilitiesResponse.status === 'fulfilled'
        ? capabilitiesResponse.value.data
        : [],
      dependencies: dependenciesResponse.status === 'fulfilled'
        ? dependenciesResponse.value.data
        : [],
      alternatives: alternativesResponse.status === 'fulfilled'
        ? alternativesResponse.value.data
        : [],
    };

    res.json(aggregated);

  } catch (error) {
    logger.error('Aggregate application error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to aggregate application data',
    });
  }
});

/**
 * GET /aggregate/blueprint/:id
 * Get complete blueprint with all applications and details
 */
router.get('/blueprint/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get blueprint
    const blueprintResponse = await axios.get(`${CATALOG_URL}/api/blueprints/${id}`);
    const blueprint = blueprintResponse.data;

    // Get full details for each application in the blueprint
    const applicationIds = blueprint.applications?.map(app => app.id) || [];

    const applicationDetails = await Promise.all(
      applicationIds.map(appId =>
        axios.get(`${CATALOG_URL}/api/applications/${appId}`)
          .then(res => res.data)
          .catch(err => {
            logger.error(`Failed to fetch app ${appId}:`, err.message);
            return null;
          })
      )
    );

    // Combine blueprint with full application details
    const aggregated = {
      ...blueprint,
      applications: applicationDetails.filter(app => app !== null),
    };

    res.json(aggregated);

  } catch (error) {
    logger.error('Aggregate blueprint error:', error);

    if (error.response?.status === 404) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Blueprint not found',
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to aggregate blueprint data',
    });
  }
});

/**
 * POST /aggregate/search
 * Enhanced search that combines multiple search types
 */
router.post('/search', async (req, res) => {
  try {
    const { query, types = ['all'], limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query parameter is required',
      });
    }

    // Perform different types of searches in parallel
    const searches = [];

    // Text search
    if (types.includes('all') || types.includes('text')) {
      searches.push(
        axios.get(`${CATALOG_URL}/api/search`, {
          params: { q: query, limit }
        }).then(res => ({ type: 'text', data: res.data }))
          .catch(() => ({ type: 'text', data: {} }))
      );
    }

    // Semantic search (if AI service is available)
    if (types.includes('all') || types.includes('semantic')) {
      searches.push(
        axios.post(`${AI_URL}/semantic-search`, {
          query,
          limit,
          threshold: 0.7
        }).then(res => ({ type: 'semantic', data: res.data }))
          .catch(() => ({ type: 'semantic', data: { results: [] } }))
      );
    }

    const results = await Promise.all(searches);

    // Merge results
    const merged = {
      query,
      results: {},
    };

    results.forEach(result => {
      merged.results[result.type] = result.data;
    });

    res.json(merged);

  } catch (error) {
    logger.error('Aggregate search error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to perform aggregate search',
    });
  }
});

/**
 * POST /aggregate/recommend
 * Get recommendations based on current stack
 */
router.post('/recommend', async (req, res) => {
  try {
    const { applicationIds, useCase } = req.body;

    if (!applicationIds || !Array.isArray(applicationIds)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'applicationIds array is required',
      });
    }

    // Get details of current applications
    const currentApps = await Promise.all(
      applicationIds.map(id =>
        axios.get(`${CATALOG_URL}/api/applications/${id}`)
          .then(res => res.data)
          .catch(() => null)
      )
    );

    // Extract capabilities from current stack
    const capabilities = currentApps
      .filter(app => app)
      .flatMap(app => app.capabilities || [])
      .map(cap => cap.id);

    // Find blueprints that match the use case or capabilities
    const blueprintsResponse = await axios.get(`${CATALOG_URL}/api/blueprints`, {
      params: {
        limit: 5,
        ...(useCase && { search: useCase })
      }
    });

    // Find complementary applications (have different capabilities)
    const appsResponse = await axios.get(`${CATALOG_URL}/api/applications`, {
      params: {
        limit: 10,
        orderBy: 'stars'
      }
    });

    const recommendations = {
      currentStack: currentApps.filter(app => app),
      suggestedBlueprints: blueprintsResponse.data.data || [],
      complementaryApps: (appsResponse.data.data || [])
        .filter(app => !applicationIds.includes(app.id)),
    };

    res.json(recommendations);

  } catch (error) {
    logger.error('Aggregate recommend error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate recommendations',
    });
  }
});

/**
 * GET /aggregate/statistics
 * Aggregate platform statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    // Fetch statistics from catalog API
    const statsResponse = await axios.get(`${CATALOG_URL}/api/statistics`);

    // Add gateway-specific statistics
    const stats = {
      ...statsResponse.data,
      gateway: {
        version: '1.0.0',
        uptime: process.uptime(),
      },
    };

    res.json(stats);

  } catch (error) {
    logger.error('Aggregate statistics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch statistics',
    });
  }
});

export { router as aggregateRoutes };
