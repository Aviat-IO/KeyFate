/**
 * TestLogger - Comprehensive logging for test execution
 */

import type { LogLevel, TestLoggerConfig, TestMetrics } from "./types"

export class TestLogger {
  private enabled: boolean
  private level: LogLevel
  private output: (message: string) => void

  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }

  constructor(config: TestLoggerConfig = {}) {
    this.enabled = config.enabled ?? true
    this.level = config.level ?? "info"
    this.output = config.output ?? console.log
  }

  logTestStart(testId: string, testName: string): void {
    this.info(`TEST START: ${testId} - ${testName}`)
  }

  logTestFailure(
    testId: string,
    error: Error,
    context: Record<string, unknown>,
  ): void {
    const message = [
      `TEST FAILURE: ${testId}`,
      `Error: ${error.message}`,
      `Context: ${JSON.stringify(context, null, 2)}`,
    ].join("\n")

    this.error(message)
  }

  logTestSuccess(testId: string, metrics: TestMetrics): void {
    const message = [
      `TEST SUCCESS: ${testId}`,
      `Duration: ${metrics.duration}ms`,
      `Assertions: ${metrics.assertions || 0}`,
      metrics.memory ? `Memory: ${metrics.memory}KB` : "",
    ]
      .filter(Boolean)
      .join(", ")

    this.info(message)
  }

  debug(message: string, data?: unknown): void {
    this.log("debug", message, data)
  }

  info(message: string, data?: unknown): void {
    this.log("info", message, data)
  }

  warn(message: string, data?: unknown): void {
    this.log("warn", message, data)
  }

  error(message: string, data?: unknown): void {
    this.log("error", message, data)
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.enabled) return
    if (this.levels[level] < this.levels[this.level]) return

    const timestamp = new Date().toISOString()
    const levelStr = level.toUpperCase().padEnd(5)
    const dataStr = data ? ` ${JSON.stringify(data)}` : ""

    this.output(`[${timestamp}] ${levelStr} ${message}${dataStr}`)
  }
}
