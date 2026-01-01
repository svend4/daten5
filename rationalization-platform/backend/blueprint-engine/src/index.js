/**
 * Blueprint Engine
 * Workflow orchestration and execution engine for blueprints
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import 'express-async-errors';

import { logger } from './utils/logger.js';
import { initDatabase } from './db/init.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import { executionRouter } from './routes/execution.js';
import { blueprintRouter } from './routes/blueprints.js';
import { healthRouter } from './routes/health.js';

// Import services
import { WorkflowExecutor } from './services/WorkflowExecutor.js';
import { initQueue } from './queue/executionQueue.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================================
// INITIALIZATION
// ============================================================================

let db;
let executor;

async function initialize() {
  // Initialize database
  db = await initDatabase();
  logger.info('Database initialized');

  // Initialize workflow executor
  executor = new WorkflowExecutor(db);
  logger.info('Workflow executor initialized');

  // Initialize execution queue
  await initQueue(db, executor);
  logger.info('Execution queue initialized');
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Attach db and executor to requests
app.use((req, res, next) => {
  req.db = db;
  req.executor = executor;
  next();
});

// ============================================================================
// ROUTES
// ============================================================================

// Documentation
app.get('/', (req, res) => {
  res.json({
    name: 'Blueprint Engine',
    version: '1.0.0',
    description: 'Workflow orchestration and execution engine',
    endpoints: {
      health: '/health',
      blueprints: '/api/blueprints',
      executions: '/api/executions',
    },
  });
});

app.use('/health', healthRouter);
app.use('/api/blueprints', blueprintRouter);
app.use('/api/executions', executionRouter);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

app.use(errorHandler);

// ============================================================================
// START SERVER
// ============================================================================

async function startServer() {
  try {
    await initialize();

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Blueprint Engine running on port ${PORT}`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down...`);

      server.close(async () => {
        if (db && db.postgres) {
          await db.postgres.end();
        }
        if (db && db.redis) {
          await db.redis.quit();
        }

        logger.info('Shutdown complete');
        process.exit(0);
      });

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

startServer();

export default app;
