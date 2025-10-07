/**
 * FailureCategorizor - Categorize and analyze test failures
 */

import type { FailureCategory } from './types';

interface CategoryPattern {
  pattern: RegExp;
  type: string;
  subtype?: string;
  recommendations: string[];
}

interface FailurePattern {
  type: string;
  count: number;
  examples: string[];
}

export class FailureCategorizor {
  private categories: Record<string, number> = {};
  private patterns: CategoryPattern[] = [
    {
      pattern: /unable to find.*element.*testid/i,
      type: 'DOM',
      subtype: 'ELEMENT_NOT_FOUND',
      recommendations: [
        'Verify element has correct data-testid attribute',
        'Check if element renders conditionally',
        'Use waitFor() for async elements',
        'Use debug() to inspect rendered output',
      ],
    },
    {
      pattern: /unable to find.*element/i,
      type: 'DOM',
      subtype: 'ELEMENT_NOT_FOUND',
      recommendations: [
        'Verify element is rendered',
        'Check selector matches actual DOM',
        'Use findBy queries for async rendering',
        'Inspect component with debug()',
      ],
    },
    {
      pattern: /network.*failed|fetch.*error/i,
      type: 'API',
      subtype: 'NETWORK_ERROR',
      recommendations: [
        'Mock API endpoints with MSW or vi.mock',
        'Verify request/response format',
        'Check interceptor configuration',
        'Ensure async operations complete',
      ],
    },
    {
      pattern: /timeout|exceeded.*ms/i,
      type: 'TIMEOUT',
      recommendations: [
        'Increase timeout for slow operations',
        'Check for hanging promises',
        'Verify async cleanup',
        'Use waitFor with custom timeout',
      ],
    },
    {
      pattern: /expected.*to.*be/i,
      type: 'ASSERTION',
      recommendations: [
        'Review assertion logic',
        'Check actual vs expected values',
        'Verify test setup',
        'Use more specific matchers',
      ],
    },
    {
      pattern: /ECONNREFUSED|connection.*refused/i,
      type: 'DATABASE',
      subtype: 'CONNECTION_ERROR',
      recommendations: [
        'Verify database connection string',
        'Check if database service is running',
        'Mock database in unit tests',
        'Use test database configuration',
      ],
    },
    {
      pattern: /found multiple elements/i,
      type: 'DOM',
      subtype: 'MULTIPLE_ELEMENTS',
      recommendations: [
        'Use getAllBy queries if multiple elements expected',
        'Make selectors more specific',
        'Add unique identifiers to elements',
        'Use within() to scope queries',
      ],
    },
  ];

  categorize(error: Error): FailureCategory {
    const message = error.message;

    for (const pattern of this.patterns) {
      if (pattern.pattern.test(message)) {
        // Track statistics
        this.categories[pattern.type] = (this.categories[pattern.type] || 0) + 1;

        return {
          type: pattern.type,
          subtype: pattern.subtype,
          recommendations: pattern.recommendations,
        };
      }
    }

    // Unknown error type
    this.categories.UNKNOWN = (this.categories.UNKNOWN || 0) + 1;

    return {
      type: 'UNKNOWN',
      recommendations: ['Review error message and stack trace'],
    };
  }

  getStatistics(): Record<string, number> {
    return { ...this.categories };
  }

  getPatterns(): FailurePattern[] {
    const patterns: FailurePattern[] = [];

    Object.entries(this.categories).forEach(([type, count]) => {
      patterns.push({
        type,
        count,
        examples: [],
      });
    });

    return patterns.sort((a, b) => b.count - a.count);
  }

  clear(): void {
    this.categories = {};
  }
}
