import { logger } from "@/lib/logger"

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"

interface CircuitBreakerConfig {
  failureThreshold: number
  timeout: number
  halfOpenAttempts: number
}

export class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime: number | null = null
  private state: CircuitState = "CLOSED"
  private halfOpenTestCount = 0

  constructor(
    private name: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      timeout: 60000, // 1 minute
      halfOpenAttempts: 3,
    },
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime! > this.config.timeout) {
        this.state = "HALF_OPEN"
        this.halfOpenTestCount = 0
        logger.info(`Circuit breaker entering HALF_OPEN state`, {
          circuit: this.name,
        })
      } else {
        throw new Error(
          `Circuit breaker is OPEN - ${this.name} service unavailable`,
        )
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failureCount = 0
    this.halfOpenTestCount = 0

    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED"
      logger.info(`Circuit breaker CLOSED - ${this.name} service recovered`)
    }
  }

  private onFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === "HALF_OPEN") {
      this.halfOpenTestCount++
      if (this.halfOpenTestCount >= this.config.halfOpenAttempts) {
        this.state = "OPEN"
        logger.warn(`Circuit breaker OPEN - ${this.name} service still failing`)
      }
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = "OPEN"
      logger.warn(
        `Circuit breaker OPEN - ${this.name} service too many failures`,
        {
          failureCount: this.failureCount,
          threshold: this.config.failureThreshold,
        },
      )
    }
  }

  getState(): CircuitState {
    return this.state
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    }
  }

  reset() {
    this.state = "CLOSED"
    this.failureCount = 0
    this.lastFailureTime = null
    this.halfOpenTestCount = 0
  }
}
