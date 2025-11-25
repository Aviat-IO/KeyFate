/**
 * Cron Job Monitoring
 *
 * Provides metrics collection, anomaly detection, and alerting
 * for cron job executions.
 */

import { logger } from "@/lib/logger"

export interface CronJobMetrics {
  jobName: string
  startTime: number
  endTime?: number
  duration?: number
  status: "running" | "success" | "failure"
  error?: string
  metadata?: {
    processed?: number
    succeeded?: number
    failed?: number
    [key: string]: unknown
  }
}

export interface CronJobStats {
  totalExecutions: number
  successCount: number
  failureCount: number
  averageDuration: number
  p95Duration: number
  p99Duration: number
  lastExecution: number
  lastSuccess: number | null
  lastFailure: number | null
}

/**
 * Monitor cron job execution with metrics and alerting
 */
export class CronMonitor {
  private metrics: Map<string, CronJobMetrics[]> = new Map()
  private readonly maxHistorySize = 100 // Keep last 100 executions

  /**
   * Start monitoring a cron job execution
   */
  startJob(jobName: string, metadata?: Record<string, unknown>): string {
    const jobId = `${jobName}-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const metric: CronJobMetrics = {
      jobName,
      startTime: Date.now(),
      status: "running",
      metadata,
    }

    if (!this.metrics.has(jobName)) {
      this.metrics.set(jobName, [])
    }

    this.metrics.get(jobName)!.push(metric)
    this.trimHistory(jobName)

    logger.info(`Cron job started: ${jobName}`, {
      jobId,
      metadata,
    })

    return jobId
  }

  /**
   * Mark a cron job execution as successful
   */
  endJob(
    jobName: string,
    success: boolean,
    metadata?: {
      processed?: number
      succeeded?: number
      failed?: number
      error?: string
      [key: string]: unknown
    },
  ): void {
    const jobs = this.metrics.get(jobName)
    if (!jobs || jobs.length === 0) {
      logger.warn(`No running job found for: ${jobName}`)
      return
    }

    // Find the most recent running job
    const job = jobs.findLast((j) => j.status === "running")
    if (!job) {
      logger.warn(`No running job found for: ${jobName}`)
      return
    }

    job.endTime = Date.now()
    job.duration = job.endTime - job.startTime
    job.status = success ? "success" : "failure"

    if (metadata) {
      job.metadata = { ...job.metadata, ...metadata }
    }

    if (!success && metadata?.error) {
      job.error = metadata.error
    }

    const stats = this.getJobStats(jobName)

    logger.info(`Cron job completed: ${jobName}`, {
      status: job.status,
      duration: job.duration,
      ...job.metadata,
      stats: {
        totalExecutions: stats.totalExecutions,
        successRate: (
          (stats.successCount / stats.totalExecutions) *
          100
        ).toFixed(1),
        avgDuration: stats.averageDuration,
      },
    })

    // Check for anomalies
    this.detectAnomalies(jobName, job, stats)
  }

  /**
   * Get statistics for a specific cron job
   */
  getJobStats(jobName: string): CronJobStats {
    const jobs = this.metrics.get(jobName) || []
    const completedJobs = jobs.filter((j) => j.status !== "running")

    if (completedJobs.length === 0) {
      return {
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        averageDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        lastExecution: 0,
        lastSuccess: null,
        lastFailure: null,
      }
    }

    const successJobs = completedJobs.filter((j) => j.status === "success")
    const failureJobs = completedJobs.filter((j) => j.status === "failure")
    const durations = completedJobs
      .map((j) => j.duration || 0)
      .filter((d) => d > 0)
      .sort((a, b) => a - b)

    const avgDuration =
      durations.reduce((sum, d) => sum + d, 0) / durations.length || 0

    const p95Index = Math.floor(durations.length * 0.95)
    const p99Index = Math.floor(durations.length * 0.99)

    return {
      totalExecutions: completedJobs.length,
      successCount: successJobs.length,
      failureCount: failureJobs.length,
      averageDuration: Math.round(avgDuration),
      p95Duration: durations[p95Index] || 0,
      p99Duration: durations[p99Index] || 0,
      lastExecution: Math.max(...completedJobs.map((j) => j.endTime || 0)),
      lastSuccess:
        successJobs.length > 0
          ? Math.max(...successJobs.map((j) => j.endTime || 0))
          : null,
      lastFailure:
        failureJobs.length > 0
          ? Math.max(...failureJobs.map((j) => j.endTime || 0))
          : null,
    }
  }

  /**
   * Get all job statistics
   */
  getAllStats(): Record<string, CronJobStats> {
    const stats: Record<string, CronJobStats> = {}

    for (const jobName of this.metrics.keys()) {
      stats[jobName] = this.getJobStats(jobName)
    }

    return stats
  }

  /**
   * Detect anomalies in cron job execution
   */
  private detectAnomalies(
    jobName: string,
    currentJob: CronJobMetrics,
    stats: CronJobStats,
  ): void {
    // Anomaly 1: Duration spike (3x average)
    if (
      currentJob.duration &&
      stats.averageDuration > 0 &&
      currentJob.duration > stats.averageDuration * 3
    ) {
      logger.warn(`Cron job duration anomaly detected: ${jobName}`, {
        currentDuration: currentJob.duration,
        averageDuration: stats.averageDuration,
        threshold: stats.averageDuration * 3,
      })
    }

    // Anomaly 2: Consecutive failures (3+)
    const recentJobs = (this.metrics.get(jobName) || [])
      .filter((j) => j.status !== "running")
      .slice(-5)
    const consecutiveFailures = recentJobs
      .reverse()
      .findIndex((j) => j.status === "success")

    if (consecutiveFailures >= 3) {
      logger.warn(`Cron job consecutive failures detected: ${jobName}`, {
        consecutiveFailures,
        recentJobs: recentJobs.length,
      })
    }

    // Anomaly 3: Low success rate (<80%)
    const successRate = (stats.successCount / stats.totalExecutions) * 100
    if (stats.totalExecutions >= 10 && successRate < 80) {
      logger.warn(`Cron job low success rate detected: ${jobName}`, {
        successRate: successRate.toFixed(1),
        threshold: 80,
        totalExecutions: stats.totalExecutions,
      })
    }

    // Anomaly 4: No processed items (if metadata available)
    if (
      currentJob.status === "success" &&
      currentJob.metadata?.processed !== undefined &&
      currentJob.metadata.processed === 0
    ) {
      logger.info(`Cron job processed zero items: ${jobName}`, {
        metadata: currentJob.metadata,
      })
    }
  }

  /**
   * Trim history to prevent unbounded growth
   */
  private trimHistory(jobName: string): void {
    const jobs = this.metrics.get(jobName)
    if (jobs && jobs.length > this.maxHistorySize) {
      this.metrics.set(jobName, jobs.slice(-this.maxHistorySize))
    }
  }

  /**
   * Clear all metrics (for testing)
   */
  clearMetrics(): void {
    this.metrics.clear()
  }

  /**
   * Get recent job executions
   */
  getRecentExecutions(jobName: string, limit = 10): CronJobMetrics[] {
    const jobs = this.metrics.get(jobName) || []
    return jobs
      .filter((j) => j.status !== "running")
      .slice(-limit)
      .reverse()
  }
}

// Singleton instance
export const cronMonitor = new CronMonitor()

/**
 * Helper function to wrap cron job execution with monitoring
 */
export async function monitorCronJob<T>(
  jobName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  cronMonitor.startJob(jobName, metadata)

  try {
    const result = await fn()

    // Extract processed/succeeded/failed counts if available
    const resultMetadata =
      typeof result === "object" && result !== null
        ? {
            processed: (result as any).processed,
            succeeded: (result as any).succeeded || (result as any).sent,
            failed: (result as any).failed,
          }
        : {}

    cronMonitor.endJob(jobName, true, {
      ...metadata,
      ...resultMetadata,
    })

    return result
  } catch (error) {
    cronMonitor.endJob(jobName, false, {
      ...metadata,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    throw error
  }
}
