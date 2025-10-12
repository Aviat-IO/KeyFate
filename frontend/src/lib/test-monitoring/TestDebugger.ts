/**
 * TestDebugger - Provide debugging context and suggestions for test failures
 */

import type {
  StackInfo,
  AsyncDebugInfo,
  MemorySnapshot,
  MemoryLeakDetection,
} from "./types"

interface FailureContext {
  error: Error
  testInfo: Record<string, unknown>
  suggestions: string[]
  category: string
}

export class TestDebugger {
  private errorPatterns = [
    {
      pattern: /unable to find.*element.*testid/i,
      category: "DOM",
      suggestions: [
        "Verify the element exists in the DOM with the correct data-testid attribute",
        "Check if element renders conditionally and may not be present yet",
        "Use waitFor() or findBy queries for async elements",
        "Inspect the rendered component output with debug()",
      ],
    },
    {
      pattern: /unable to find.*element/i,
      category: "DOM",
      suggestions: [
        "Check if element is rendered",
        "Verify selector is correct",
        "Use findBy queries for async elements",
        "Check if element is hidden or conditional",
      ],
    },
    {
      pattern: /network.*failed|fetch.*error|ECONNREFUSED/i,
      category: "API",
      suggestions: [
        "Verify API endpoint is mocked correctly",
        "Check network interceptors are configured",
        "Ensure mock server is running",
        "Verify request/response format matches expectations",
      ],
    },
    {
      pattern: /timeout|exceeded.*ms/i,
      category: "TIMEOUT",
      suggestions: [
        "Increase timeout value if operation is legitimately slow",
        "Check for hanging promises or unresolved async operations",
        "Verify all async operations complete properly",
        "Use waitFor with custom timeout for slow operations",
      ],
    },
    {
      pattern: /expected.*to.*be/i,
      category: "ASSERTION",
      suggestions: [
        "Review the assertion logic",
        "Check actual vs expected values",
        "Verify test setup is correct",
        "Consider using more specific matchers",
      ],
    },
    {
      pattern: /ECONNREFUSED|connection.*refused/i,
      category: "DATABASE",
      suggestions: [
        "Verify database connection string is correct",
        "Check if database service is running",
        "Ensure test database is properly configured",
        "Mock database connections in unit tests",
      ],
    },
  ]

  getFailureContext(
    error: Error,
    testInfo: Record<string, unknown>,
  ): FailureContext {
    const category = this.categorizeError(error)
    const suggestions = this.getSuggestions(error)

    return {
      error,
      testInfo,
      suggestions,
      category,
    }
  }

  getSuggestions(error: Error): string[] {
    const message = error.message

    for (const { pattern, suggestions } of this.errorPatterns) {
      if (pattern.test(message)) {
        return suggestions
      }
    }

    return ["Review error message and stack trace for clues"]
  }

  categorizeError(error: Error): string {
    const message = error.message

    for (const { pattern, category } of this.errorPatterns) {
      if (pattern.test(message)) {
        return category
      }
    }

    return "UNKNOWN"
  }

  extractStackInfo(error: Error): StackInfo {
    const stack = error.stack || ""
    const stackLines = stack.split("\n")

    // Find first line with file info (skip error message line)
    for (let i = 1; i < stackLines.length; i++) {
      const line = stackLines[i]
      const match = line.match(/\((.+):(\d+):(\d+)\)/)

      if (match) {
        return {
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
        }
      }

      // Alternative format without parentheses
      const altMatch = line.match(/at\s+(.+):(\d+):(\d+)/)
      if (altMatch) {
        return {
          file: altMatch[1],
          line: parseInt(altMatch[2], 10),
          column: parseInt(altMatch[3], 10),
        }
      }
    }

    return {
      file: "unknown",
      line: 0,
      column: 0,
    }
  }

  getAsyncDebugInfo(): AsyncDebugInfo {
    // Note: These would be actual runtime checks in a real implementation
    return {
      pendingPromises: 0,
      timers: 0,
      suggestions: [
        "Use vi.runAllTimers() to clear pending timers",
        "Ensure all promises resolve or reject",
        "Check for unhandled promise rejections",
        "Use waitFor() for async state updates",
      ],
    }
  }

  detectMemoryLeak(snapshot: MemorySnapshot): MemoryLeakDetection {
    const growth = snapshot.after.heapUsed - snapshot.before.heapUsed
    const threshold = 1000000 // 1MB

    return {
      hasLeak: growth > threshold,
      growth,
      threshold,
    }
  }
}
