/**
 * Workflow Executor
 * Executes blueprint workflows step by step
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import retry from 'retry';
import { logger } from '../utils/logger.js';

export class WorkflowExecutor {
  constructor(db) {
    this.db = db;
    this.executions = new Map(); // Track running executions
  }

  /**
   * Execute a blueprint
   */
  async execute(blueprintId, params = {}) {
    const executionId = uuidv4();

    try {
      logger.info(`Starting blueprint execution: ${executionId}`);

      // Get blueprint from database
      const blueprint = await this.db.postgres.oneOrNone(
        'SELECT * FROM blueprints WHERE id = $1',
        [blueprintId]
      );

      if (!blueprint) {
        throw new Error(`Blueprint ${blueprintId} not found`);
      }

      // Create execution record
      await this.db.postgres.none(`
        INSERT INTO blueprint_executions (
          id, blueprint_id, status, started_at, parameters
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
      `, [executionId, blueprintId, 'running', params]);

      // Track execution
      this.executions.set(executionId, {
        blueprintId,
        status: 'running',
        currentStep: 0,
        startedAt: new Date(),
      });

      // Execute workflow
      const result = await this.executeWorkflow(
        executionId,
        blueprint.workflow,
        params
      );

      // Update execution status
      await this.db.postgres.none(`
        UPDATE blueprint_executions
        SET status = $1,
            completed_at = CURRENT_TIMESTAMP,
            result = $2
        WHERE id = $3
      `, ['completed', result, executionId]);

      this.executions.delete(executionId);

      logger.info(`Blueprint execution completed: ${executionId}`);

      return {
        executionId,
        status: 'completed',
        result,
      };

    } catch (error) {
      logger.error(`Blueprint execution failed: ${executionId}`, error);

      // Update execution status
      await this.db.postgres.none(`
        UPDATE blueprint_executions
        SET status = $1,
            completed_at = CURRENT_TIMESTAMP,
            error = $2
        WHERE id = $3
      `, ['failed', error.message, executionId]).catch(() => {});

      this.executions.delete(executionId);

      throw error;
    }
  }

  /**
   * Execute workflow steps
   */
  async executeWorkflow(executionId, workflow, params) {
    if (!workflow || !workflow.steps) {
      throw new Error('Invalid workflow: missing steps');
    }

    const context = {
      params,
      results: {},
      env: process.env,
    };

    logger.info(`Executing workflow with ${workflow.steps.length} steps`);

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];

      logger.info(`Executing step ${i + 1}/${workflow.steps.length}: ${step.name}`);

      // Update execution progress
      await this.updateExecutionProgress(executionId, i + 1, workflow.steps.length, step.name);

      // Execute step
      try {
        const stepResult = await this.executeStep(step, context);
        context.results[step.name] = stepResult;

        logger.info(`Step ${step.name} completed successfully`);

      } catch (error) {
        logger.error(`Step ${step.name} failed:`, error);

        // Check if step is optional
        if (!step.optional) {
          throw new Error(`Required step "${step.name}" failed: ${error.message}`);
        }

        logger.warn(`Optional step ${step.name} failed, continuing...`);
        context.results[step.name] = {
          error: error.message,
          skipped: true,
        };
      }
    }

    return context.results;
  }

  /**
   * Execute a single step
   */
  async executeStep(step, context) {
    const { type, config } = step;

    switch (type) {
      case 'api_call':
        return await this.executeApiCall(config, context);

      case 'configure':
        return await this.executeConfigure(config, context);

      case 'validate':
        return await this.executeValidate(config, context);

      case 'wait':
        return await this.executeWait(config, context);

      case 'conditional':
        return await this.executeConditional(config, context);

      default:
        throw new Error(`Unknown step type: ${type}`);
    }
  }

  /**
   * Execute API call step
   */
  async executeApiCall(config, context) {
    const {
      method = 'GET',
      url,
      headers = {},
      body,
      retries = 3,
      timeout = 30000,
    } = config;

    // Interpolate variables in URL and body
    const interpolatedUrl = this.interpolate(url, context);
    const interpolatedBody = body ? this.interpolate(body, context) : undefined;

    logger.debug(`API call: ${method} ${interpolatedUrl}`);

    // Setup retry
    const operation = retry.operation({
      retries,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 10000,
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async (currentAttempt) => {
        try {
          const response = await axios({
            method,
            url: interpolatedUrl,
            headers,
            data: interpolatedBody,
            timeout,
          });

          resolve(response.data);

        } catch (error) {
          logger.warn(`API call attempt ${currentAttempt} failed:`, error.message);

          if (operation.retry(error)) {
            return;
          }

          reject(operation.mainError());
        }
      });
    });
  }

  /**
   * Execute configure step
   */
  async executeConfigure(config, context) {
    const { service, settings } = config;

    logger.info(`Configuring ${service}...`);

    // Interpolate settings
    const interpolatedSettings = this.interpolate(settings, context);

    // Store configuration
    await this.db.redis.setex(
      `config:${service}`,
      3600, // 1 hour TTL
      JSON.stringify(interpolatedSettings)
    );

    return {
      service,
      configured: true,
      settings: interpolatedSettings,
    };
  }

  /**
   * Execute validation step
   */
  async executeValidate(config, context) {
    const { checks } = config;

    logger.info(`Running ${checks.length} validation checks...`);

    const results = [];

    for (const check of checks) {
      const { name, condition } = check;

      // Evaluate condition
      const passed = this.evaluateCondition(condition, context);

      results.push({
        name,
        passed,
        condition,
      });

      if (!passed && !check.optional) {
        throw new Error(`Validation failed: ${name}`);
      }
    }

    return {
      allPassed: results.every(r => r.passed),
      results,
    };
  }

  /**
   * Execute wait step
   */
  async executeWait(config, context) {
    const { duration } = config; // in milliseconds

    logger.info(`Waiting for ${duration}ms...`);

    await new Promise(resolve => setTimeout(resolve, duration));

    return {
      waited: duration,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute conditional step
   */
  async executeConditional(config, context) {
    const { condition, thenSteps, elseSteps } = config;

    const conditionMet = this.evaluateCondition(condition, context);

    logger.info(`Conditional: ${condition} = ${conditionMet}`);

    const stepsToExecute = conditionMet ? thenSteps : elseSteps;

    if (!stepsToExecute || stepsToExecute.length === 0) {
      return { conditionMet, executed: false };
    }

    const results = [];

    for (const step of stepsToExecute) {
      const result = await this.executeStep(step, context);
      results.push(result);
    }

    return {
      conditionMet,
      results,
    };
  }

  /**
   * Interpolate variables in string/object
   */
  interpolate(value, context) {
    if (typeof value === 'string') {
      // Replace ${variable} with actual values
      return value.replace(/\$\{([^}]+)\}/g, (match, path) => {
        return this.getValueByPath(context, path) || match;
      });
    }

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map(item => this.interpolate(item, context));
      }

      const result = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.interpolate(val, context);
      }
      return result;
    }

    return value;
  }

  /**
   * Get value by dot notation path
   */
  getValueByPath(obj, path) {
    return path.split('.').reduce((current, part) => current?.[part], obj);
  }

  /**
   * Evaluate simple conditions
   */
  evaluateCondition(condition, context) {
    // Simple condition evaluation
    // Format: "params.env === 'production'" or "results.step1.success"

    try {
      // Very simple eval (in production, use a proper expression parser)
      // For now, just support simple path checks
      const value = this.getValueByPath(context, condition);
      return Boolean(value);

    } catch (error) {
      logger.warn(`Failed to evaluate condition: ${condition}`, error);
      return false;
    }
  }

  /**
   * Update execution progress
   */
  async updateExecutionProgress(executionId, currentStep, totalSteps, stepName) {
    const progress = Math.round((currentStep / totalSteps) * 100);

    await this.db.postgres.none(`
      UPDATE blueprint_executions
      SET current_step = $1,
          total_steps = $2,
          current_step_name = $3,
          progress = $4
      WHERE id = $5
    `, [currentStep, totalSteps, stepName, progress, executionId]).catch(() => {});

    // Update in-memory tracking
    if (this.executions.has(executionId)) {
      const execution = this.executions.get(executionId);
      execution.currentStep = currentStep;
      execution.progress = progress;
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId) {
    // Check in-memory first
    if (this.executions.has(executionId)) {
      return this.executions.get(executionId);
    }

    // Check database
    const execution = await this.db.postgres.oneOrNone(
      'SELECT * FROM blueprint_executions WHERE id = $1',
      [executionId]
    );

    return execution;
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId) {
    logger.info(`Cancelling execution: ${executionId}`);

    if (this.executions.has(executionId)) {
      this.executions.delete(executionId);
    }

    await this.db.postgres.none(`
      UPDATE blueprint_executions
      SET status = 'cancelled',
          completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [executionId]);

    return { cancelled: true };
  }
}
