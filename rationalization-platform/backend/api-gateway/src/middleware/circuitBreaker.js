/**
 * Circuit Breaker Middleware
 * Prevents cascading failures by breaking circuits to failing services
 */

import { logger } from '../utils/logger.js';

// Circuit breaker state
const circuits = new Map();

// Circuit breaker configuration
const config = {
  failureThreshold: 5,        // Number of failures before opening circuit
  successThreshold: 2,        // Number of successes to close circuit
  timeout: 60000,             // Time in ms to wait before attempting reset (1 minute)
  monitoringPeriod: 120000,   // Time window for counting failures (2 minutes)
};

class CircuitBreaker {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = [];
    this.successes = 0;
    this.nextAttempt = Date.now();
  }

  /**
   * Record a successful request
   */
  recordSuccess() {
    this.failures = [];

    if (this.state === 'HALF_OPEN') {
      this.successes++;

      if (this.successes >= config.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
        logger.info(`Circuit CLOSED for ${this.serviceName}`);
      }
    }
  }

  /**
   * Record a failed request
   */
  recordFailure() {
    const now = Date.now();

    // Clean old failures outside monitoring period
    this.failures = this.failures.filter(
      timestamp => now - timestamp < config.monitoringPeriod
    );

    this.failures.push(now);

    // Check if we should open the circuit
    if (this.failures.length >= config.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = now + config.timeout;
      this.successes = 0;

      logger.warn(`Circuit OPENED for ${this.serviceName} (${this.failures.length} failures)`);
    }
  }

  /**
   * Check if request should be allowed
   */
  canRequest() {
    const now = Date.now();

    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        // Check if timeout has passed
        if (now >= this.nextAttempt) {
          this.state = 'HALF_OPEN';
          this.successes = 0;
          logger.info(`Circuit HALF_OPEN for ${this.serviceName} (attempting recovery)`);
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return true;

      default:
        return true;
    }
  }

  /**
   * Get circuit status
   */
  getStatus() {
    return {
      service: this.serviceName,
      state: this.state,
      failures: this.failures.length,
      successes: this.successes,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null,
    };
  }
}

/**
 * Get or create circuit breaker for service
 */
function getCircuit(serviceName) {
  if (!circuits.has(serviceName)) {
    circuits.set(serviceName, new CircuitBreaker(serviceName));
  }
  return circuits.get(serviceName);
}

/**
 * Circuit breaker middleware factory
 */
export function circuitBreaker(serviceName) {
  return (req, res, next) => {
    const circuit = getCircuit(serviceName);

    // Check if circuit allows request
    if (!circuit.canRequest()) {
      logger.warn(`Circuit breaker blocked request to ${serviceName}`);

      return res.status(503).json({
        error: 'Service Unavailable',
        message: `${serviceName} service is temporarily unavailable due to repeated failures`,
        service: serviceName,
        circuitState: circuit.state,
        retryAfter: Math.ceil((circuit.nextAttempt - Date.now()) / 1000),
      });
    }

    // Intercept response to record success/failure
    const originalSend = res.send;
    res.send = function(data) {
      // Consider 5xx errors as failures
      if (res.statusCode >= 500) {
        circuit.recordFailure();
      } else {
        circuit.recordSuccess();
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Get all circuit statuses (for monitoring)
 */
export function getCircuitStatuses() {
  const statuses = {};
  for (const [name, circuit] of circuits.entries()) {
    statuses[name] = circuit.getStatus();
  }
  return statuses;
}

/**
 * Reset a circuit breaker
 */
export function resetCircuit(serviceName) {
  const circuit = getCircuit(serviceName);
  circuit.state = 'CLOSED';
  circuit.failures = [];
  circuit.successes = 0;
  logger.info(`Circuit manually reset for ${serviceName}`);
  return circuit.getStatus();
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuits() {
  for (const [name, circuit] of circuits.entries()) {
    circuit.state = 'CLOSED';
    circuit.failures = [];
    circuit.successes = 0;
  }
  logger.info('All circuits manually reset');
}
