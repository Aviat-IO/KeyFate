// Enhanced connection manager with retry logic and circuit breaker pattern
import postgres from "postgres"

interface ConnectionOptions {
  max?: number
  idle_timeout?: number
  connect_timeout?: number
  max_lifetime?: number
  connection_timeout?: number
  statement_timeout?: number
  [key: string]: any
}

interface RetryConfig {
  maxAttempts: number
  initialDelay: number
  maxDelay: number
  backoffFactor: number
}

class ConnectionManager {
  private static instance: ConnectionManager | null = null
  private connection: ReturnType<typeof postgres> | null = null
  private connectionAttempts = 0
  private lastSuccessfulConnection: Date | null = null
  private circuitBreakerOpen = false
  private circuitBreakerResetTime: Date | null = null
  private isShuttingDown = false
  private activeQueries = 0
  private totalConnections = 0
  private totalErrors = 0

  // Circuit breaker configuration
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3 // Open after 3 failures
  private readonly CIRCUIT_BREAKER_RESET_MS = 30000 // Try again after 30 seconds

  // Retry configuration
  private readonly retryConfig: RetryConfig = {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 16000,
    backoffFactor: 2,
  }

  private constructor() {
    this.setupGracefulShutdown()
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager()
    }
    return ConnectionManager.instance
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        return
      }

      console.log(`\n🛑 Received ${signal} - initiating graceful shutdown`)
      this.isShuttingDown = true

      const shutdownTimeout = setTimeout(() => {
        console.error("⚠️ Shutdown timeout - forcing exit")
        process.exit(1)
      }, 30000) // 30 second timeout

      try {
        console.log(
          `⏳ Waiting for ${this.activeQueries} active queries to complete...`,
        )

        let waitTime = 0
        const maxWait = 25000 // 25 seconds
        while (this.activeQueries > 0 && waitTime < maxWait) {
          await this.delay(100)
          waitTime += 100
        }

        if (this.activeQueries > 0) {
          console.warn(
            `⚠️ ${this.activeQueries} queries still active after ${maxWait}ms`,
          )
        }

        await this.closeConnection()
        console.log("✅ Graceful shutdown complete")
        clearTimeout(shutdownTimeout)
        process.exit(0)
      } catch (error) {
        console.error("❌ Error during shutdown:", error)
        clearTimeout(shutdownTimeout)
        process.exit(1)
      }
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"))
    process.on("SIGINT", () => shutdown("SIGINT"))
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private calculateBackoff(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.initialDelay *
        Math.pow(this.retryConfig.backoffFactor, attempt - 1),
      this.retryConfig.maxDelay,
    )
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000
  }

  private checkCircuitBreaker(): void {
    if (this.circuitBreakerOpen && this.circuitBreakerResetTime) {
      if (new Date() > this.circuitBreakerResetTime) {
        console.log("🔧 Circuit breaker reset - attempting reconnection")
        this.circuitBreakerOpen = false
        this.connectionAttempts = 0
      }
    }
  }

  private openCircuitBreaker(): void {
    this.circuitBreakerOpen = true
    this.circuitBreakerResetTime = new Date(
      Date.now() + this.CIRCUIT_BREAKER_RESET_MS,
    )
    console.error(
      `🚨 Circuit breaker OPEN - will retry at ${this.circuitBreakerResetTime.toISOString()}`,
    )
  }

  async getConnection(
    connectionString: string,
    options: ConnectionOptions = {},
  ): Promise<ReturnType<typeof postgres>> {
    // Check circuit breaker status
    this.checkCircuitBreaker()

    if (this.circuitBreakerOpen) {
      throw new Error(
        `Database circuit breaker is OPEN. Will reset at ${this.circuitBreakerResetTime?.toISOString()}`,
      )
    }

    // Return existing healthy connection
    if (this.connection && this.lastSuccessfulConnection) {
      // Check if connection is still healthy (not older than 5 minutes)
      const connectionAge = Date.now() - this.lastSuccessfulConnection.getTime()
      if (connectionAge < 5 * 60 * 1000) {
        return this.connection
      } else {
        console.log("🔄 Connection is stale, creating new connection")
        await this.closeConnection()
      }
    }

    // Enhanced connection options with better defaults for production
    const enhancedOptions: ConnectionOptions = {
      max: process.env.NODE_ENV === "production" ? 20 : 10, // Higher pool size for production
      idle_timeout: 30, // 30 seconds idle timeout
      connect_timeout: 10, // 10 seconds connection timeout
      max_lifetime: 60 * 30, // Recycle connections every 30 minutes
      connection_timeout: 10000, // 10 second connection timeout
      statement_timeout: 30000, // 30 second statement timeout
      // Enable keep-alive for long-running connections
      keep_alive: true,
      ...options,
      // Add event handlers for monitoring
      onnotice: (notice: any) => {
        if (process.env.NODE_ENV === "development") {
          console.log("📢 PostgreSQL Notice:", notice.message)
        }
      },
    }

    // Parse connection string to extract details
    const isUnixSocket =
      connectionString.includes("/cloudsql/") ||
      connectionString.includes("host=/cloudsql/")
    const isPrivateIP =
      connectionString.includes("10.2.0.3") ||
      connectionString.includes("10.0.") ||
      connectionString.includes("10.1.")

    let actualConnectionString = connectionString

    if (isUnixSocket) {
      console.log("🔌 Using Unix socket connection via Cloud SQL proxy")

      // Parse the Unix socket connection string
      // Format: postgresql://user:pass@/database?host=/cloudsql/PROJECT:REGION:INSTANCE
      const urlMatch = connectionString.match(
        /postgresql:\/\/([^:]+):([^@]+)@\/([^?]+)\?host=(.+)/,
      )

      if (urlMatch) {
        const [, username, password, database, socketPath] = urlMatch
        console.log(
          `📝 Parsed Unix socket - Database: ${database}, Socket: ${socketPath}`,
        )

        // postgres.js needs the socket path as the host parameter
        // Format for postgres.js with Unix socket
        enhancedOptions.host = socketPath
        enhancedOptions.database = database
        enhancedOptions.username = decodeURIComponent(username)
        // URL-decode the password since it may contain encoded special characters like %2F, %2B, %3D
        enhancedOptions.password = decodeURIComponent(password)
        enhancedOptions.ssl = false
        enhancedOptions.max = 3

        // Use a dummy connection string since we're passing all params via options
        actualConnectionString = "postgres://localhost"
      } else {
        console.error("⚠️ Failed to parse Unix socket connection string")
      }
    } else if (isPrivateIP) {
      console.log("🔍 Using private IP connection via VPC")
      // For VPC connections, SSL is not needed
      enhancedOptions.ssl = false
    }

    // Attempt connection with retry logic
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        console.log(
          `🔌 Connection attempt ${attempt}/${this.retryConfig.maxAttempts}`,
        )

        this.connection = postgres(actualConnectionString, enhancedOptions)

        // Test the connection immediately
        const testResult = await this
          .connection`SELECT 1 as test, current_database() as db`
        console.log(
          `✅ Database connected successfully to: ${testResult[0].db}`,
        )

        // Reset circuit breaker on success
        this.connectionAttempts = 0
        this.lastSuccessfulConnection = new Date()
        this.circuitBreakerOpen = false
        this.totalConnections++

        // Log pool configuration
        if (process.env.NODE_ENV === "development") {
          console.log("📊 Connection pool configured:", {
            max: enhancedOptions.max,
            idle_timeout: enhancedOptions.idle_timeout,
            connect_timeout: enhancedOptions.connect_timeout,
            max_lifetime: enhancedOptions.max_lifetime,
          })
        }

        return this.connection
      } catch (error: unknown) {
        const err = error as {
          code?: string
          message?: string
          address?: string
          port?: number
        }
        console.error(`❌ Connection attempt ${attempt} failed:`, {
          code: err.code,
          message: err.message,
          address: err.address,
          port: err.port,
        })

        this.connectionAttempts++
        this.totalErrors++

        // Check if we should open circuit breaker
        if (this.connectionAttempts >= this.CIRCUIT_BREAKER_THRESHOLD) {
          this.openCircuitBreaker()
          throw new Error(
            `Database connection failed after ${attempt} attempts. Circuit breaker opened.`,
          )
        }

        // If not last attempt, wait and retry
        if (attempt < this.retryConfig.maxAttempts) {
          const backoffDelay = this.calculateBackoff(attempt)
          console.log(`⏳ Waiting ${backoffDelay}ms before retry...`)
          await this.delay(backoffDelay)
        } else {
          // Final attempt failed
          throw new Error(
            `Database connection failed after ${this.retryConfig.maxAttempts} attempts: ${err.message || "Unknown error"}`,
          )
        }
      }
    }

    throw new Error("Failed to establish database connection")
  }

  async closeConnection(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end()
        console.log("🔌 Database connection closed")
      } catch (error) {
        console.error("Error closing database connection:", error)
      } finally {
        this.connection = null
        this.lastSuccessfulConnection = null
      }
    }
  }

  // Health check method for monitoring
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connection) {
        return false
      }

      const result = await this.connection`SELECT 1 as health`
      return result[0].health === 1
    } catch (error) {
      console.error("Health check failed:", error)
      return false
    }
  }

  // Get connection stats for monitoring
  getStats() {
    return {
      connected: !!this.connection,
      lastSuccessfulConnection: this.lastSuccessfulConnection,
      connectionAttempts: this.connectionAttempts,
      circuitBreakerOpen: this.circuitBreakerOpen,
      circuitBreakerResetTime: this.circuitBreakerResetTime,
      isShuttingDown: this.isShuttingDown,
      activeQueries: this.activeQueries,
      totalConnections: this.totalConnections,
      totalErrors: this.totalErrors,
      uptime: this.lastSuccessfulConnection
        ? Date.now() - this.lastSuccessfulConnection.getTime()
        : 0,
    }
  }

  // Track query execution for metrics
  trackQueryStart(): void {
    this.activeQueries++
  }

  trackQueryEnd(): void {
    this.activeQueries = Math.max(0, this.activeQueries - 1)
  }

  // Reset for testing purposes only
  reset() {
    this.connection = null
    this.connectionAttempts = 0
    this.lastSuccessfulConnection = null
    this.circuitBreakerOpen = false
    this.circuitBreakerResetTime = null
  }
}

export const connectionManager = ConnectionManager.getInstance()
