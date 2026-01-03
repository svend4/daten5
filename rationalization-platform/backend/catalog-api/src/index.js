/**
 * Rationalization Platform - Catalog API
 * Main entry point for the Universal Catalog API
 */

import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import local modules
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { createContext } from './graphql/context.js';
import { initDatabase } from './db/init.js';
import logger from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

// REST routes
import applicationsRouter from './routes/applications.js';
import capabilitiesRouter from './routes/capabilities.js';
import blueprintsRouter from './routes/blueprints.js';
import searchRouter from './routes/search.js';
import healthRouter from './routes/health.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    // Initialize database connections
    logger.info('Initializing database connections...');
    const db = await initDatabase();

    // Create Express app
    const app = express();
    const httpServer = http.createServer(app);

    // =========================================================================
    // MIDDLEWARE
    // =========================================================================

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }));

    // Compression
    app.use(compression());

    // CORS
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
    }));

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    app.use(morgan('combined', {
      stream: { write: message => logger.info(message.trim()) }
    }));

    // Rate limiting
    app.use('/api/', rateLimiter);

    // =========================================================================
    // REST API ROUTES
    // =========================================================================

    app.use('/api/health', healthRouter);
    app.use('/api/applications', applicationsRouter);
    app.use('/api/capabilities', capabilitiesRouter);
    app.use('/api/blueprints', blueprintsRouter);
    app.use('/api/search', searchRouter);

    // =========================================================================
    // GRAPHQL SERVER
    // =========================================================================

    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
      ],
      formatError: (error) => {
        logger.error('GraphQL Error:', error);
        return {
          message: error.message,
          code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
          ...(NODE_ENV === 'development' && { stack: error.extensions?.exception?.stacktrace }),
        };
      },
      introspection: NODE_ENV !== 'production',
    });

    await apolloServer.start();

    // Mount GraphQL endpoint
    app.use(
      '/graphql',
      cors(),
      express.json(),
      expressMiddleware(apolloServer, {
        context: async ({ req }) => createContext({ req, db }),
      })
    );

    // =========================================================================
    // DOCUMENTATION
    // =========================================================================

    // GraphQL Playground (dev only)
    if (NODE_ENV === 'development') {
      app.get('/', (req, res) => {
        res.redirect('/graphql');
      });
    }

    // API documentation
    app.get('/api', (req, res) => {
      res.json({
        name: 'Rationalization Catalog API',
        version: '1.0.0',
        endpoints: {
          rest: {
            health: '/api/health',
            applications: '/api/applications',
            capabilities: '/api/capabilities',
            blueprints: '/api/blueprints',
            search: '/api/search',
          },
          graphql: '/graphql',
        },
        documentation: '/api/docs',
      });
    });

    // =========================================================================
    // ERROR HANDLING
    // =========================================================================

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    // Global error handler
    app.use(errorHandler);

    // =========================================================================
    // START SERVER
    // =========================================================================

    await new Promise((resolve) => {
      httpServer.listen(PORT, () => {
        resolve();
      });
    });

    logger.info(`🚀 Server ready at http://localhost:${PORT}`);
    logger.info(`📊 GraphQL endpoint: http://localhost:${PORT}/graphql`);
    logger.info(`🔍 REST API: http://localhost:${PORT}/api`);
    logger.info(`🌍 Environment: ${NODE_ENV}`);

    // =========================================================================
    // GRACEFUL SHUTDOWN
    // =========================================================================

    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      httpServer.close(async () => {
        logger.info('HTTP server closed');

        // Close database connections
        await db.postgres.end();
        await db.neo4j.close();
        await db.redis.quit();

        logger.info('Database connections closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
