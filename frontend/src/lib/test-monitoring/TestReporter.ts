/**
 * TestReporter - Generate comprehensive test reports
 */

import type { TestReport, FailureReport, PerformanceReport } from './types';
import { TestAnalytics } from './TestAnalytics';
import { FailureCategorizor } from './FailureCategorizor';

export class TestReporter {
  private analytics: TestAnalytics;
  private categorizor: FailureCategorizor;
  private exportHandler?: (path: string, content: string) => void;

  constructor(analytics: TestAnalytics) {
    this.analytics = analytics;
    this.categorizor = new FailureCategorizor();
  }

  setExportHandler(handler: (path: string, content: string) => void): void {
    this.exportHandler = handler;
  }

  generateReport(): TestReport {
    const summary = this.analytics.getSummary();
    const failedTests = this.analytics.getFailedTests();
    const slowestTests = this.analytics.getSlowestTests(10);

    // Categorize failures
    const failures: FailureReport[] = failedTests.map((test) => {
      const category = this.categorizor.categorize(test.error!);

      return {
        testId: test.testId,
        name: test.name,
        error: test.error!.message,
        category,
        suggestions: category.recommendations,
        stackTrace: test.error!.stack,
      };
    });

    // Identify critical failures
    const criticalFailures = failures.filter((f) =>
      f.category.type === 'DATABASE' ||
      f.category.type === 'API' ||
      f.error.toLowerCase().includes('critical')
    );

    // Performance metrics
    const performance: PerformanceReport = {
      averageDuration: summary.averageDuration,
      totalDuration: this.analytics
        .getSummary()
        .averageDuration * summary.total,
      slowestTests: slowestTests.map((t) => ({
        testId: t.testId,
        name: t.name,
        duration: t.duration,
      })),
      bottlenecks: slowestTests
        .filter((t) => t.duration > 1000)
        .map((t) => ({
          testId: t.testId,
          duration: t.duration,
          threshold: 1000,
        })),
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(failures, performance);

    return {
      summary,
      failures,
      criticalFailures,
      performance,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }

  formatAsMarkdown(): string {
    const report = this.generateReport();
    const lines: string[] = [];

    lines.push('# Test Report');
    lines.push('');
    lines.push(`Generated: ${report.timestamp}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total Tests: ${report.summary.total}`);
    lines.push(`- Passed: ${report.summary.passed}`);
    lines.push(`- Failed: ${report.summary.failed}`);
    lines.push(`- Skipped: ${report.summary.skipped}`);
    lines.push(
      `- Success Rate: ${(report.summary.successRate * 100).toFixed(1)}%`
    );
    lines.push(
      `- Average Duration: ${report.summary.averageDuration.toFixed(0)}ms`
    );
    lines.push('');

    if (report.criticalFailures.length > 0) {
      lines.push('## Critical Failures');
      lines.push('');
      report.criticalFailures.forEach((failure) => {
        lines.push(`### ${failure.name}`);
        lines.push('');
        lines.push(`**Error:** ${failure.error}`);
        lines.push(`**Category:** ${failure.category.type}`);
        lines.push('');
        lines.push('**Suggestions:**');
        failure.suggestions.forEach((s) => lines.push(`- ${s}`));
        lines.push('');
      });
    }

    if (report.failures.length > 0) {
      lines.push('## All Failures');
      lines.push('');
      report.failures.forEach((failure) => {
        lines.push(`- **${failure.name}:** ${failure.error}`);
      });
      lines.push('');
    }

    lines.push('## Performance');
    lines.push('');
    lines.push(
      `- Average Duration: ${report.performance.averageDuration.toFixed(0)}ms`
    );
    lines.push(
      `- Total Duration: ${report.performance.totalDuration.toFixed(0)}ms`
    );
    lines.push('');

    if (report.performance.slowestTests.length > 0) {
      lines.push('### Slowest Tests');
      lines.push('');
      report.performance.slowestTests.slice(0, 5).forEach((test) => {
        lines.push(`- ${test.name}: ${test.duration}ms`);
      });
      lines.push('');
    }

    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      report.recommendations.forEach((rec) => lines.push(`- ${rec}`));
      lines.push('');
    }

    return lines.join('\n');
  }

  formatAsJson(): string {
    const report = this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  async exportReport(path: string, format: 'json' | 'markdown'): Promise<void> {
    if (!this.exportHandler) {
      throw new Error('Export handler not configured');
    }

    const content =
      format === 'json' ? this.formatAsJson() : this.formatAsMarkdown();

    this.exportHandler(path, content);
  }

  private generateRecommendations(
    failures: FailureReport[],
    performance: PerformanceReport
  ): string[] {
    const recommendations: string[] = [];

    // Failure-based recommendations
    const categoryStats: Record<string, number> = {};
    failures.forEach((f) => {
      categoryStats[f.category.type] =
        (categoryStats[f.category.type] || 0) + 1;
    });

    Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        if (count > 5) {
          recommendations.push(
            `High ${category} failure rate (${count} failures) - review ${category.toLowerCase()} patterns`
          );
        }
      });

    // Performance-based recommendations
    if (performance.bottlenecks.length > 0) {
      recommendations.push(
        `${performance.bottlenecks.length} tests exceed 1000ms threshold - optimize slow tests`
      );
    }

    if (performance.averageDuration > 500) {
      recommendations.push(
        'High average test duration - consider parallelization or mocking'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests performing well - no issues detected');
    }

    return recommendations;
  }
}
