/**
 * Authentication Middleware
 * JWT-based authentication for API Gateway
 */

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Authenticate middleware
 */
export function authenticate(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    // Check API key first
    if (apiKey) {
      return authenticateApiKey(apiKey, req, res, next);
    }

    // Check JWT token
    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user to request
    req.user = decoded;

    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has expired',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Authenticate using API key
 */
function authenticateApiKey(apiKey, req, res, next) {
  // TODO: Implement API key validation against database
  // For now, just check if key exists

  if (!apiKey || apiKey.length < 32) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }

  // Attach API key info to request
  req.apiKey = {
    key: apiKey,
    type: 'api-key',
  };

  next();
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    }

    next();

  } catch (error) {
    // Silently fail - user is just not authenticated
    next();
  }
}

/**
 * Require specific role
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userRoles = req.user.roles || [];
    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`,
      });
    }

    next();
  };
}

/**
 * Generate JWT token (for testing/development)
 */
export function generateToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
