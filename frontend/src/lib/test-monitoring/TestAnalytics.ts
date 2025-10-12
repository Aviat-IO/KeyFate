/**
 * TestAnalytics - Track and analyze test execution results
 */

import type { TestResult, TestSummary } from "./types"

interface TestHistory {
  results: TestResult[]
  lastStatus?: "passed" | "failed" | "skipped"
}

export class TestAnalytics {
  private results: TestResult[] = []
  private testHistory: Map<string, TestHistory> = new Map()

  recordTestResult(result: TestResult): void {
    this.results.push(result)

    // Track history for flaky test detection
    const history = this.testHistory.get(result.testId) || { results: [] }
    history.results.push(result)
    history.lastStatus = result.status
    this.testHistory.set(result.testId, history)
  }

  getSummary(): TestSummary {
    const total = this.results.length
    const passed = this.results.filter((r) => r.status === "passed").length
    const failed = this.results.filter((r) => r.status === "failed").length
    const skipped = this.results.filter((r) => r.status === "skipped").length

    const successRate = total > 0 ? passed / total : 0
    const averageDuration =
      total > 0
        ? this.results.reduce((sum, r) => sum + r.duration, 0) / total
        : 0

    return {
      total,
      passed,
      failed,
      skipped,
      successRate,
      averageDuration,
    }
  }

  getFailuresByCategory(): Record<string, number> {
    const categories: Record<string, number> = {}

    this.results
      .filter((r) => r.status === "failed" && r.category)
      .forEach((r) => {
        const category = r.category!
        categories[category] = (categories[category] || 0) + 1
      })

    return categories
  }

  getSlowestTests(count: number = 10): TestResult[] {
    return [...this.results]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, count)
  }

  getFlakyTests(): Array<{ testId: string; name: string; flipCount: number }> {
    const flakyTests: Array<{
      testId: string
      name: string
      flipCount: number
    }> = []

    this.testHistory.forEach((history, testId) => {
      if (history.results.length < 2) return

      let flips = 0
      for (let i = 1; i < history.results.length; i++) {
        if (history.results[i].status !== history.results[i - 1].status) {
          flips++
        }
      }

      if (flips > 0) {
        flakyTests.push({
          testId,
          name: history.results[0].name,
          flipCount: flips,
        })
      }
    })

    return flakyTests.sort((a, b) => b.flipCount - a.flipCount)
  }

  getFailedTests(): TestResult[] {
    return this.results.filter((r) => r.status === "failed")
  }

  clear(): void {
    this.results = []
    this.testHistory.clear()
  }
}
