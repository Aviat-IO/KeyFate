# Test Monitoring and Debugging System

## Overview

The test monitoring system provides comprehensive logging, analytics, debugging utilities, and performance monitoring for the test suite. It helps identify failure patterns, track performance trends, and provide actionable debugging information.

## Components

### TestLogger

Provides detailed logging for test execution with configurable log levels and output formatting.

```typescript
import { TestLogger } from '@/lib/test-monitoring';

const logger = new TestLogger({
  enabled: true,
  level: 'info', // debug, info, warn, error
  output: (message) => console.log(message),
});

// Log test events
logger.logTestStart('test-1', 'Example Test');
logger.logTestSuccess('test-1', { duration: 100, assertions: 5 });
logger.logTestFailure('test-2', error, { context: 'data' });
```

### TestAnalytics

Tracks test execution results and calculates statistics.

```typescript
import { TestAnalytics } from '@/lib/test-monitoring';

const analytics = new TestAnalytics();

// Record test results
analytics.recordTestResult({
  testId: 'test-1',
  name: 'Example Test',
  status: 'passed',
  duration: 150,
});

// Get insights
const summary = analytics.getSummary();
const slowTests = analytics.getSlowestTests(10);
const flakyTests = analytics.getFlakyTests();
const failuresByCategory = analytics.getFailuresByCategory();
```

### TestDebugger

Provides debugging context and suggestions for test failures.

```typescript
import { TestDebugger } from '@/lib/test-monitoring';

const debugger = new TestDebugger();

// Get failure context
const context = debugger.getFailureContext(error, {
  testFile: 'example.test.ts',
  testName: 'should do something',
});

// Get suggestions
const suggestions = debugger.getSuggestions(error);

// Categorize errors
const category = debugger.categorizeError(error);
```

### PerformanceMonitor

Tracks and analyzes test performance.

```typescript
import { PerformanceMonitor } from '@/lib/test-monitoring';

const monitor = new PerformanceMonitor();

// Track test performance
monitor.startTest('test-1');
// ... test execution ...
monitor.endTest('test-1');

// Get performance insights
const bottlenecks = monitor.getBottlenecks({ threshold: 1000 });
const trend = monitor.getPerformanceTrend('test-1');
const alerts = monitor.getPerformanceAlerts({ threshold: 2.0 });
```

### FailureCategorizor

Categorizes test failures and provides recommendations.

```typescript
import { FailureCategorizor } from '@/lib/test-monitoring';

const categorizor = new FailureCategorizor();

// Categorize failures
const category = categorizor.categorize(error);
// Returns: { type: 'DOM', subtype: 'ELEMENT_NOT_FOUND', recommendations: [...] }

// Get statistics
const stats = categorizor.getStatistics();
const patterns = categorizor.getPatterns();
```

### TestReporter

Generates comprehensive test reports.

```typescript
import { TestReporter, TestAnalytics } from '@/lib/test-monitoring';

const analytics = new TestAnalytics();
const reporter = new TestReporter(analytics);

// Generate report
const report = reporter.generateReport();

// Format as markdown or JSON
const markdown = reporter.formatAsMarkdown();
const json = reporter.formatAsJson();

// Export to file
await reporter.exportReport('/tmp/test-report.json', 'json');
```

### TestMonitor

Unified coordinator for all monitoring components.

```typescript
import { TestMonitor } from '@/lib/test-monitoring';

const monitor = new TestMonitor({
  enableLogging: true,
  enableAnalytics: true,
  enablePerformance: true,
});

// Test lifecycle hooks
monitor.beforeTest({ testId: 'test-1', name: 'Example Test' });
monitor.afterTest({
  testId: 'test-1',
  name: 'Example Test',
  status: 'passed',
  duration: 150,
});

monitor.onTestFailure({
  testId: 'test-2',
  name: 'Failing Test',
  error: new Error('Test failed'),
  duration: 100,
});

// Generate comprehensive report
const report = monitor.generateReport();

// Get bottlenecks
const bottlenecks = monitor.getBottlenecks();

// Real-time updates
monitor.onUpdate((data) => {
  console.log('Test event:', data);
});
```

## Failure Categories

The system automatically categorizes failures into these types:

- **DOM**: Element not found, multiple elements, query issues
- **API**: Network errors, request failures, connection issues
- **TIMEOUT**: Test timeouts, hanging promises, slow operations
- **ASSERTION**: Failed assertions, value mismatches
- **DATABASE**: Connection errors, query failures
- **UNKNOWN**: Uncategorized errors

Each category includes specific recommendations for fixing the issue.

## Performance Monitoring

### Bottleneck Detection

Tests exceeding performance thresholds are automatically identified:

```typescript
const bottlenecks = monitor.getBottlenecks({ threshold: 1000 });
// Returns: [{ testId: 'slow-test', duration: 5000, threshold: 1000 }]
```

### Performance Trends

Track performance changes over multiple test runs:

```typescript
const trend = monitor.getPerformanceTrend('test-1');
// Returns: { direction: 'degrading', averageChange: 50 }
```

### Performance Alerts

Get notified of significant performance changes:

```typescript
const alerts = monitor.getPerformanceAlerts({ threshold: 2.0 });
// Returns: [{ testId: 'test-1', type: 'regression', baseline: 100, current: 250 }]
```

## Integration with Vitest

### Setup File Integration

Add to `__tests__/setup.ts`:

```typescript
import { TestMonitor } from '@/lib/test-monitoring';
import { beforeEach, afterEach } from 'vitest';

const monitor = new TestMonitor({
  enableLogging: process.env.TEST_LOGGING === 'true',
  enableAnalytics: true,
  enablePerformance: true,
});

let currentTestId: string;

beforeEach((context) => {
  currentTestId = context.task.id;
  monitor.beforeTest({
    testId: currentTestId,
    name: context.task.name,
  });
});

afterEach((context) => {
  const result = context.task.result;

  if (result?.state === 'fail') {
    monitor.onTestFailure({
      testId: currentTestId,
      name: context.task.name,
      error: result.errors?.[0] || new Error('Unknown error'),
      duration: result.duration || 0,
    });
  } else {
    monitor.afterTest({
      testId: currentTestId,
      name: context.task.name,
      status: result?.state === 'pass' ? 'passed' : 'skipped',
      duration: result?.duration || 0,
    });
  }
});

// Generate report after all tests
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    const report = monitor.generateReport();
    console.log('\n=== Test Report ===');
    console.log(report.summary);
  });
}
```

## Generating Test Reports

### Command Line

```bash
# Run tests with monitoring
npm test

# Generate comprehensive report
npm run test:report

# Generate markdown report
npm run test:report --markdown
```

### Programmatic Usage

```typescript
import { TestMonitor } from '@/lib/test-monitoring';

const monitor = new TestMonitor();

// ... run tests with monitoring ...

const report = monitor.generateReport();
console.log('Test Summary:', report.summary);
console.log('Failures:', report.failures.length);
console.log('Performance:', report.performance);
console.log('Recommendations:', report.recommendations);
```

## Debugging Test Failures

### Common Error Patterns

#### DOM Element Not Found

```
Error: Unable to find an element by: [data-testid="button"]

Suggestions:
- Verify element has correct data-testid attribute
- Check if element renders conditionally
- Use waitFor() for async elements
- Use debug() to inspect rendered output
```

#### API Network Errors

```
Error: Network request failed

Suggestions:
- Mock API endpoints with MSW or vi.mock
- Verify request/response format
- Check interceptor configuration
- Ensure async operations complete
```

#### Test Timeouts

```
Error: Timeout exceeded: 5000ms

Suggestions:
- Increase timeout for slow operations
- Check for hanging promises
- Verify async cleanup
- Use waitFor with custom timeout
```

## Best Practices

1. **Enable logging during development**
   ```typescript
   const logger = new TestLogger({ enabled: process.env.NODE_ENV === 'development' });
   ```

2. **Track flaky tests**
   ```typescript
   const flakyTests = analytics.getFlakyTests();
   if (flakyTests.length > 0) {
     console.warn('Flaky tests detected:', flakyTests);
   }
   ```

3. **Monitor performance regression**
   ```typescript
   const alerts = performanceMonitor.getPerformanceAlerts({ threshold: 2.0 });
   if (alerts.length > 0) {
     console.error('Performance regression detected:', alerts);
   }
   ```

4. **Generate reports in CI/CD**
   ```bash
   npm run test:report --markdown
   # Upload test-report.md as artifact
   ```

5. **Use categorization for issue tracking**
   ```typescript
   const categories = categorizor.getStatistics();
   Object.entries(categories).forEach(([type, count]) => {
     if (count > 5) {
       // Create issue for high failure rate in this category
     }
   });
   ```

## Current Test Suite Status

As of the last run:

- **Total Tests**: 2067
- **Passed**: 1488 (72%)
- **Failed**: 569 (28%)
- **Test Files**: 201 (112 passed, 89 failed)

### Top Failure Categories

Based on automated categorization:

1. **DOM Errors** (~40%): Element not found, multiple elements
2. **API Errors** (~25%): Network failures, database connections
3. **Assertion Errors** (~20%): Value mismatches, state errors
4. **Timeout Errors** (~10%): Hanging tests, slow operations
5. **Other** (~5%): Miscellaneous issues

### Performance Bottlenecks

Tests exceeding 1000ms threshold:

- Database integration tests
- E2E workflow tests
- Complex component rendering tests

See generated reports for detailed breakdown.

## Troubleshooting

### High Memory Usage

```typescript
const leakDetection = debugger.detectMemoryLeak({
  before: { heapUsed: 1000000 },
  after: { heapUsed: 5000000 },
});

if (leakDetection.hasLeak) {
  console.warn('Memory leak detected:', leakDetection);
}
```

### Async Issues

```typescript
const asyncInfo = debugger.getAsyncDebugInfo();
console.log('Pending promises:', asyncInfo.pendingPromises);
console.log('Active timers:', asyncInfo.timers);
console.log('Suggestions:', asyncInfo.suggestions);
```

### Stack Trace Analysis

```typescript
const stackInfo = debugger.extractStackInfo(error);
console.log(`Error at ${stackInfo.file}:${stackInfo.line}:${stackInfo.column}`);
```

## Contributing

When adding new error patterns, update the `FailureCategorizor` with:

1. Pattern regex
2. Category type and subtype
3. Actionable recommendations

Example:

```typescript
{
  pattern: /new error pattern/i,
  type: 'CATEGORY',
  subtype: 'SUBTYPE',
  recommendations: [
    'Specific actionable advice',
    'Related debugging steps',
  ],
}
```
