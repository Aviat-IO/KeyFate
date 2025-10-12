/**
 * Type definitions for test monitoring infrastructure
 */

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface TestLoggerConfig {
  enabled?: boolean
  level?: LogLevel
  output?: (message: string) => void
}

export interface TestResult {
  testId: string
  name: string
  status: "passed" | "failed" | "skipped"
  duration: number
  error?: Error
  category?: string
  severity?: "low" | "medium" | "high" | "critical"
}

export interface TestMetrics {
  duration: number
  assertions?: number
  memory?: number
  memoryUsed?: number
}

export interface FailureCategory {
  type: string
  subtype?: string
  recommendations: string[]
}

export interface PerformanceMetrics {
  duration: number
  memoryUsed?: number
}

export interface PerformanceTrend {
  direction: "improving" | "stable" | "degrading"
  averageChange: number
}

export interface PerformanceAlert {
  testId: string
  type: "regression" | "improvement"
  message: string
  baseline: number
  current: number
}

export interface TestSummary {
  total: number
  passed: number
  failed: number
  skipped: number
  successRate: number
  averageDuration: number
}

export interface TestReport {
  summary: TestSummary
  failures: FailureReport[]
  criticalFailures: FailureReport[]
  performance: PerformanceReport
  recommendations: string[]
  timestamp: string
}

export interface FailureReport {
  testId: string
  name: string
  error: string
  category: FailureCategory
  suggestions: string[]
  stackTrace?: string
}

export interface PerformanceReport {
  averageDuration: number
  totalDuration: number
  slowestTests: Array<{ testId: string; name: string; duration: number }>
  bottlenecks: Array<{ testId: string; duration: number; threshold: number }>
}

export interface StackInfo {
  file: string
  line: number
  column: number
  function?: string
}

export interface AsyncDebugInfo {
  pendingPromises: number
  timers: number
  suggestions: string[]
}

export interface MemorySnapshot {
  before: { heapUsed: number }
  after: { heapUsed: number }
}

export interface MemoryLeakDetection {
  hasLeak: boolean
  growth: number
  threshold?: number
}
