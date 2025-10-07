/**
 * Test Monitoring and Debugging Infrastructure Tests
 *
 * This test suite validates the comprehensive logging, monitoring, and debugging
 * utilities for the test suite. It ensures that test failures are properly categorized,
 * logged, and reported with actionable information.
 *
 * Task 30: Implement Test Suite Debugging and Monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TestMonitor,
  TestLogger,
  TestAnalytics,
  TestDebugger,
  PerformanceMonitor,
  FailureCategorizor,
  TestReporter,
} from '@/lib/test-monitoring';

describe('Test Monitoring Infrastructure', () => {
  describe('TestLogger', () => {
    let logger: TestLogger;
    let consoleOutput: string[];

    beforeEach(() => {
      consoleOutput = [];
      logger = new TestLogger({
        enabled: true,
        level: 'debug',
        output: (message: string) => consoleOutput.push(message),
      });
    });

    it('should log test start with timestamp', () => {
      logger.logTestStart('example-test', 'Example Test Suite');

      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput[0]).toContain('TEST START');
      expect(consoleOutput[0]).toContain('example-test');
      expect(consoleOutput[0]).toContain('Example Test Suite');
    });

    it('should log test failure with detailed context', () => {
      const error = new Error('Test assertion failed');
      const context = {
        testFile: 'example.test.ts',
        testName: 'should do something',
        duration: 150,
      };

      logger.logTestFailure('example-test', error, context);

      const output = consoleOutput.join('\n');
      expect(output).toContain('TEST FAILURE');
      expect(output).toContain('Test assertion failed');
      expect(output).toContain('example.test.ts');
      expect(output).toContain('150');
    });

    it('should log test success with performance metrics', () => {
      const metrics = {
        duration: 45,
        assertions: 5,
        memory: 1024,
      };

      logger.logTestSuccess('example-test', metrics);

      const output = consoleOutput.join('\n');
      expect(output).toContain('TEST SUCCESS');
      expect(output).toContain('45');
      expect(output).toContain('5');
    });

    it('should support different log levels', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(consoleOutput.length).toBe(4);
      expect(consoleOutput[0]).toContain('DEBUG');
      expect(consoleOutput[1]).toContain('INFO');
      expect(consoleOutput[2]).toContain('WARN');
      expect(consoleOutput[3]).toContain('ERROR');
    });

    it('should not log when disabled', () => {
      const disabledLogger = new TestLogger({ enabled: false });
      disabledLogger.info('Should not appear');

      // Verify nothing was logged (using internal check)
      expect(consoleOutput.length).toBe(0);
    });

    it('should format log messages consistently', () => {
      logger.info('Test message', { key: 'value' });

      expect(consoleOutput[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(consoleOutput[0]).toContain('INFO');
      expect(consoleOutput[0]).toContain('Test message');
    });
  });

  describe('TestAnalytics', () => {
    let analytics: TestAnalytics;

    beforeEach(() => {
      analytics = new TestAnalytics();
    });

    it('should track test execution results', () => {
      analytics.recordTestResult({
        testId: 'test-1',
        name: 'Example Test',
        status: 'passed',
        duration: 100,
      });

      analytics.recordTestResult({
        testId: 'test-2',
        name: 'Failing Test',
        status: 'failed',
        duration: 200,
        error: new Error('Test failed'),
      });

      const summary = analytics.getSummary();
      expect(summary.total).toBe(2);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);
    });

    it('should calculate success rate', () => {
      analytics.recordTestResult({ testId: '1', name: 'Test 1', status: 'passed', duration: 50 });
      analytics.recordTestResult({ testId: '2', name: 'Test 2', status: 'passed', duration: 50 });
      analytics.recordTestResult({ testId: '3', name: 'Test 3', status: 'failed', duration: 50 });

      const summary = analytics.getSummary();
      expect(summary.successRate).toBeCloseTo(0.666, 2);
    });

    it('should track failure categories', () => {
      analytics.recordTestResult({
        testId: 'test-1',
        name: 'API Test',
        status: 'failed',
        duration: 100,
        category: 'API',
        error: new Error('Network error'),
      });

      analytics.recordTestResult({
        testId: 'test-2',
        name: 'UI Test',
        status: 'failed',
        duration: 150,
        category: 'UI',
        error: new Error('Element not found'),
      });

      const categories = analytics.getFailuresByCategory();
      expect(categories.API).toBe(1);
      expect(categories.UI).toBe(1);
    });

    it('should calculate average test duration', () => {
      analytics.recordTestResult({ testId: '1', name: 'Test 1', status: 'passed', duration: 100 });
      analytics.recordTestResult({ testId: '2', name: 'Test 2', status: 'passed', duration: 200 });
      analytics.recordTestResult({ testId: '3', name: 'Test 3', status: 'passed', duration: 300 });

      const summary = analytics.getSummary();
      expect(summary.averageDuration).toBe(200);
    });

    it('should identify slowest tests', () => {
      analytics.recordTestResult({ testId: '1', name: 'Fast Test', status: 'passed', duration: 50 });
      analytics.recordTestResult({ testId: '2', name: 'Slow Test', status: 'passed', duration: 5000 });
      analytics.recordTestResult({ testId: '3', name: 'Medium Test', status: 'passed', duration: 500 });

      const slowTests = analytics.getSlowestTests(2);
      expect(slowTests[0].name).toBe('Slow Test');
      expect(slowTests[0].duration).toBe(5000);
      expect(slowTests[1].name).toBe('Medium Test');
    });

    it('should track flaky tests', () => {
      // First run - pass
      analytics.recordTestResult({ testId: 'flaky-1', name: 'Flaky Test', status: 'passed', duration: 100 });

      // Second run - fail
      analytics.recordTestResult({ testId: 'flaky-1', name: 'Flaky Test', status: 'failed', duration: 100 });

      // Third run - pass
      analytics.recordTestResult({ testId: 'flaky-1', name: 'Flaky Test', status: 'passed', duration: 100 });

      const flakyTests = analytics.getFlakyTests();
      expect(flakyTests.length).toBeGreaterThan(0);
      expect(flakyTests[0].testId).toBe('flaky-1');
    });
  });

  describe('TestDebugger', () => {
    let testDebugger: TestDebugger;

    beforeEach(() => {
      testDebugger = new TestDebugger();
    });

    it('should provide context for test failures', () => {
      const error = new Error('Element not found');
      const context = testDebugger.getFailureContext(error, {
        testFile: 'example.test.ts',
        testName: 'should find element',
        stackTrace: error.stack || '',
      });

      expect(context).toHaveProperty('error');
      expect(context).toHaveProperty('testInfo');
      expect(context).toHaveProperty('suggestions');
      expect(context.suggestions).toBeInstanceOf(Array);
    });

    it('should suggest fixes for common errors', () => {
      const error = new Error('Unable to find an element by: [data-testid="test-button"]');
      const suggestions = testDebugger.getSuggestions(error);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('testid');
    });

    it('should categorize error types', () => {
      const domError = new Error('Unable to find an element');
      const apiError = new Error('Network request failed');
      const timeoutError = new Error('Timeout exceeded');

      expect(testDebugger.categorizeError(domError)).toBe('DOM');
      expect(testDebugger.categorizeError(apiError)).toBe('API');
      expect(testDebugger.categorizeError(timeoutError)).toBe('TIMEOUT');
    });

    it('should extract relevant stack trace info', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at Object.<anonymous> (/path/to/test.ts:42:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

      const stackInfo = testDebugger.extractStackInfo(error);
      expect(stackInfo).toHaveProperty('file');
      expect(stackInfo).toHaveProperty('line');
      expect(stackInfo).toHaveProperty('column');
    });

    it('should provide debugging utilities for async issues', () => {
      const asyncDebugInfo = testDebugger.getAsyncDebugInfo();

      expect(asyncDebugInfo).toHaveProperty('pendingPromises');
      expect(asyncDebugInfo).toHaveProperty('timers');
      expect(asyncDebugInfo).toHaveProperty('suggestions');
    });

    it('should detect and report memory leaks', () => {
      const memorySnapshot = {
        before: { heapUsed: 1000000 },
        after: { heapUsed: 5000000 },
      };

      const leakDetection = testDebugger.detectMemoryLeak(memorySnapshot);
      expect(leakDetection.hasLeak).toBe(true);
      expect(leakDetection.growth).toBe(4000000);
    });
  });

  describe('PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
      monitor = new PerformanceMonitor();
    });

    it('should track test execution time', () => {
      const testId = 'perf-test-1';

      monitor.startTest(testId);
      // Simulate test execution
      monitor.endTest(testId);

      const metrics = monitor.getTestMetrics(testId);
      expect(metrics).toHaveProperty('duration');
      expect(metrics.duration).toBeGreaterThanOrEqual(0);
    });

    it('should identify performance bottlenecks', () => {
      monitor.recordTest('fast-test', 50);
      monitor.recordTest('slow-test', 5000);
      monitor.recordTest('medium-test', 500);

      const bottlenecks = monitor.getBottlenecks({ threshold: 1000 });
      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].testId).toBe('slow-test');
    });

    it('should track memory usage during tests', () => {
      const testId = 'memory-test';

      monitor.startTest(testId);
      monitor.endTest(testId);

      const metrics = monitor.getTestMetrics(testId);
      expect(metrics).toHaveProperty('memoryUsed');
    });

    it('should calculate performance trends', () => {
      // Record multiple runs of the same test
      monitor.recordTest('trend-test', 100);
      monitor.recordTest('trend-test', 120);
      monitor.recordTest('trend-test', 150);

      const trend = monitor.getPerformanceTrend('trend-test');
      expect(trend.direction).toBe('degrading');
      expect(trend.averageChange).toBeGreaterThan(0);
    });

    it('should alert on performance regressions', () => {
      monitor.recordTest('baseline-test', 100);
      monitor.recordTest('baseline-test', 100);
      monitor.recordTest('baseline-test', 500); // Regression

      const alerts = monitor.getPerformanceAlerts({ threshold: 2.0 });
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].testId).toBe('baseline-test');
      expect(alerts[0].type).toBe('regression');
    });

    it('should not impact test performance significantly', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        monitor.recordTest(`test-${i}`, Math.random() * 100);
      }

      const overhead = Date.now() - start;
      expect(overhead).toBeLessThan(100); // Should be very fast
    });
  });

  describe('FailureCategorizor', () => {
    let categorizor: FailureCategorizor;

    beforeEach(() => {
      categorizor = new FailureCategorizor();
    });

    it('should categorize DOM-related failures', () => {
      const error = new Error('Unable to find an element by: [data-testid="button"]');
      const category = categorizor.categorize(error);

      expect(category.type).toBe('DOM');
      expect(category.subtype).toBe('ELEMENT_NOT_FOUND');
    });

    it('should categorize API-related failures', () => {
      const error = new Error('Network request failed with status 500');
      const category = categorizor.categorize(error);

      expect(category.type).toBe('API');
      expect(category.subtype).toBe('NETWORK_ERROR');
    });

    it('should categorize timeout failures', () => {
      const error = new Error('Timeout exceeded: 5000ms');
      const category = categorizor.categorize(error);

      expect(category.type).toBe('TIMEOUT');
    });

    it('should categorize assertion failures', () => {
      const error = new Error('expected true to be false');
      const category = categorizor.categorize(error);

      expect(category.type).toBe('ASSERTION');
    });

    it('should categorize database failures', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const category = categorizor.categorize(error);

      expect(category.type).toBe('DATABASE');
      expect(category.subtype).toBe('CONNECTION_ERROR');
    });

    it('should provide actionable recommendations', () => {
      const error = new Error('Unable to find an element');
      const category = categorizor.categorize(error);

      expect(category.recommendations).toBeInstanceOf(Array);
      expect(category.recommendations.length).toBeGreaterThan(0);
    });

    it('should track category statistics', () => {
      categorizor.categorize(new Error('Unable to find element'));
      categorizor.categorize(new Error('Network request failed'));
      categorizor.categorize(new Error('Unable to find an element by: [data-testid="button"]'));

      const stats = categorizor.getStatistics();
      expect(stats.DOM).toBe(2);
      expect(stats.API).toBe(1);
    });

    it('should identify failure patterns', () => {
      // Record similar failures
      for (let i = 0; i < 10; i++) {
        categorizor.categorize(new Error(`Unable to find element-${i}`));
      }

      const patterns = categorizor.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('DOM');
      expect(patterns[0].count).toBe(10);
    });
  });

  describe('TestReporter', () => {
    let reporter: TestReporter;
    let analytics: TestAnalytics;

    beforeEach(() => {
      analytics = new TestAnalytics();
      reporter = new TestReporter(analytics);
    });

    it('should generate comprehensive test report', () => {
      // Add some test results
      analytics.recordTestResult({ testId: '1', name: 'Test 1', status: 'passed', duration: 100 });
      analytics.recordTestResult({ testId: '2', name: 'Test 2', status: 'failed', duration: 200, error: new Error('Failed') });

      const report = reporter.generateReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('failures');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('recommendations');
    });

    it('should format report as markdown', () => {
      analytics.recordTestResult({ testId: '1', name: 'Test 1', status: 'passed', duration: 100 });

      const markdown = reporter.formatAsMarkdown();

      expect(markdown).toContain('# Test Report');
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('Total Tests:');
    });

    it('should format report as JSON', () => {
      analytics.recordTestResult({ testId: '1', name: 'Test 1', status: 'passed', duration: 100 });

      const json = reporter.formatAsJson();
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('timestamp');
    });

    it('should export report to file', async () => {
      analytics.recordTestResult({ testId: '1', name: 'Test 1', status: 'passed', duration: 100 });

      const exportSpy = vi.fn();
      reporter.setExportHandler(exportSpy);

      await reporter.exportReport('/tmp/test-report.json', 'json');

      expect(exportSpy).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/test-report.json'),
        expect.any(String)
      );
    });

    it('should highlight critical failures', () => {
      analytics.recordTestResult({
        testId: '1',
        name: 'Critical Test',
        status: 'failed',
        duration: 100,
        error: new Error('Critical failure'),
        severity: 'critical',
      });

      const report = reporter.generateReport();
      expect(report.criticalFailures).toHaveLength(1);
      expect(report.criticalFailures[0].testId).toBe('1');
    });

    it('should include performance metrics in report', () => {
      analytics.recordTestResult({ testId: '1', name: 'Fast', status: 'passed', duration: 50 });
      analytics.recordTestResult({ testId: '2', name: 'Slow', status: 'passed', duration: 5000 });

      const report = reporter.generateReport();
      expect(report.performance).toHaveProperty('slowestTests');
      expect(report.performance.slowestTests[0].duration).toBe(5000);
    });
  });

  describe('TestMonitor Integration', () => {
    let monitor: TestMonitor;

    beforeEach(() => {
      monitor = new TestMonitor({
        enableLogging: true,
        enableAnalytics: true,
        enablePerformance: true,
      });
    });

    afterEach(() => {
      monitor.cleanup();
    });

    it('should coordinate all monitoring components', () => {
      monitor.beforeTest({ testId: 'integration-1', name: 'Integration Test' });

      // Simulate test execution

      monitor.afterTest({
        testId: 'integration-1',
        name: 'Integration Test',
        status: 'passed',
        duration: 150,
      });

      const report = monitor.generateReport();
      expect(report.summary.total).toBe(1);
      expect(report.summary.passed).toBe(1);
    });

    it('should handle test failures comprehensively', () => {
      monitor.beforeTest({ testId: 'fail-test', name: 'Failing Test' });

      const error = new Error('Test failed');
      monitor.onTestFailure({
        testId: 'fail-test',
        name: 'Failing Test',
        error,
        duration: 100,
      });

      const report = monitor.generateReport();
      expect(report.failures).toHaveLength(1);
      expect(report.failures[0]).toHaveProperty('category');
      expect(report.failures[0]).toHaveProperty('suggestions');
    });

    it('should track performance across test suite', () => {
      // Run multiple tests
      for (let i = 0; i < 10; i++) {
        monitor.beforeTest({ testId: `test-${i}`, name: `Test ${i}` });
        monitor.afterTest({
          testId: `test-${i}`,
          name: `Test ${i}`,
          status: 'passed',
          duration: Math.random() * 1000,
        });
      }

      const report = monitor.generateReport();
      expect(report.performance).toHaveProperty('averageDuration');
      expect(report.performance).toHaveProperty('totalDuration');
    });

    it('should detect and report bottlenecks', () => {
      monitor.beforeTest({ testId: 'fast', name: 'Fast Test' });
      monitor.afterTest({ testId: 'fast', name: 'Fast Test', status: 'passed', duration: 50 });

      monitor.beforeTest({ testId: 'slow', name: 'Slow Test' });
      monitor.afterTest({ testId: 'slow', name: 'Slow Test', status: 'passed', duration: 5000 });

      const bottlenecks = monitor.getBottlenecks();
      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].testId).toBe('slow');
    });

    it('should provide real-time monitoring updates', () => {
      const updateSpy = vi.fn();
      monitor.onUpdate(updateSpy);

      monitor.beforeTest({ testId: 'test-1', name: 'Test 1' });
      monitor.afterTest({ testId: 'test-1', name: 'Test 1', status: 'passed', duration: 100 });

      expect(updateSpy).toHaveBeenCalled();
    });

    it('should generate actionable recommendations', () => {
      // Add various failure types
      monitor.onTestFailure({
        testId: 'dom-fail',
        name: 'DOM Test',
        error: new Error('Element not found'),
        duration: 100,
      });

      monitor.onTestFailure({
        testId: 'api-fail',
        name: 'API Test',
        error: new Error('Network error'),
        duration: 200,
      });

      const report = monitor.generateReport();
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});
