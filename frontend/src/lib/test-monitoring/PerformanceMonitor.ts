/**
 * PerformanceMonitor - Track and analyze test performance
 */

import type {
  PerformanceMetrics,
  PerformanceTrend,
  PerformanceAlert,
} from "./types"

interface TestPerformance {
  testId: string
  durations: number[]
  memoryUsage: number[]
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map()
  private startTimes: Map<string, number> = new Map()
  private history: Map<string, TestPerformance> = new Map()

  startTest(testId: string): void {
    this.startTimes.set(testId, Date.now())
  }

  endTest(testId: string): void {
    const startTime = this.startTimes.get(testId)
    if (!startTime) return

    const duration = Date.now() - startTime
    const memoryUsed = this.getMemoryUsage()

    this.metrics.set(testId, {
      duration,
      memoryUsed,
    })

    // Update history
    const history = this.history.get(testId) || {
      testId,
      durations: [],
      memoryUsage: [],
    }
    history.durations.push(duration)
    history.memoryUsage.push(memoryUsed)
    this.history.set(testId, history)

    this.startTimes.delete(testId)
  }

  recordTest(testId: string, duration: number): void {
    const memoryUsed = this.getMemoryUsage()

    this.metrics.set(testId, {
      duration,
      memoryUsed,
    })

    // Update history
    const history = this.history.get(testId) || {
      testId,
      durations: [],
      memoryUsage: [],
    }
    history.durations.push(duration)
    history.memoryUsage.push(memoryUsed)
    this.history.set(testId, history)
  }

  getTestMetrics(testId: string): PerformanceMetrics {
    return (
      this.metrics.get(testId) || {
        duration: 0,
        memoryUsed: 0,
      }
    )
  }

  getBottlenecks(options: { threshold: number }): Array<{
    testId: string
    duration: number
    threshold: number
  }> {
    const bottlenecks: Array<{
      testId: string
      duration: number
      threshold: number
    }> = []

    this.metrics.forEach((metrics, testId) => {
      if (metrics.duration > options.threshold) {
        bottlenecks.push({
          testId,
          duration: metrics.duration,
          threshold: options.threshold,
        })
      }
    })

    return bottlenecks.sort((a, b) => b.duration - a.duration)
  }

  getPerformanceTrend(testId: string): PerformanceTrend {
    const history = this.history.get(testId)
    if (!history || history.durations.length < 2) {
      return {
        direction: "stable",
        averageChange: 0,
      }
    }

    const durations = history.durations
    let totalChange = 0

    for (let i = 1; i < durations.length; i++) {
      totalChange += durations[i] - durations[i - 1]
    }

    const averageChange = totalChange / (durations.length - 1)

    let direction: "improving" | "stable" | "degrading"
    if (averageChange > 10) {
      direction = "degrading"
    } else if (averageChange < -10) {
      direction = "improving"
    } else {
      direction = "stable"
    }

    return {
      direction,
      averageChange,
    }
  }

  getPerformanceAlerts(options: { threshold: number }): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = []

    this.history.forEach((history, testId) => {
      if (history.durations.length < 2) return

      const baseline =
        history.durations.slice(0, -1).reduce((sum, d) => sum + d, 0) /
        (history.durations.length - 1)

      const current = history.durations[history.durations.length - 1]
      const ratio = current / baseline

      if (ratio >= options.threshold) {
        alerts.push({
          testId,
          type: "regression",
          message: `Performance regression detected: ${current}ms vs baseline ${baseline.toFixed(0)}ms`,
          baseline,
          current,
        })
      } else if (ratio <= 1 / options.threshold) {
        alerts.push({
          testId,
          type: "improvement",
          message: `Performance improvement: ${current}ms vs baseline ${baseline.toFixed(0)}ms`,
          baseline,
          current,
        })
      }
    })

    return alerts
  }

  private getMemoryUsage(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }

  clear(): void {
    this.metrics.clear()
    this.startTimes.clear()
    this.history.clear()
  }
}
