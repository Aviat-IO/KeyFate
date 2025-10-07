/**
 * TestMonitor - Unified test monitoring coordinator
 */

import type { TestReport, TestResult } from './types';
import { TestLogger } from './TestLogger';
import { TestAnalytics } from './TestAnalytics';
import { TestDebugger } from './TestDebugger';
import { PerformanceMonitor } from './PerformanceMonitor';
import { FailureCategorizor } from './FailureCategorizor';
import { TestReporter } from './TestReporter';

interface TestMonitorConfig {
  enableLogging?: boolean;
  enableAnalytics?: boolean;
  enablePerformance?: boolean;
}

interface TestStartInfo {
  testId: string;
  name: string;
}

interface TestEndInfo {
  testId: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
}

interface TestFailureInfo {
  testId: string;
  name: string;
  error: Error;
  duration: number;
}

export class TestMonitor {
  private logger: TestLogger;
  private analytics: TestAnalytics;
  private debugger: TestDebugger;
  private performanceMonitor: PerformanceMonitor;
  private categorizor: FailureCategorizor;
  private reporter: TestReporter;
  private updateCallbacks: Array<(data: unknown) => void> = [];

  constructor(config: TestMonitorConfig = {}) {
    this.logger = new TestLogger({
      enabled: config.enableLogging ?? true,
    });

    this.analytics = new TestAnalytics();
    this.debugger = new TestDebugger();
    this.performanceMonitor = new PerformanceMonitor();
    this.categorizor = new FailureCategorizor();
    this.reporter = new TestReporter(this.analytics);
  }

  beforeTest(info: TestStartInfo): void {
    this.logger.logTestStart(info.testId, info.name);
    this.performanceMonitor.startTest(info.testId);
    this.notifyUpdate({ event: 'testStart', data: info });
  }

  afterTest(info: TestEndInfo): void {
    // Record the actual duration if provided, otherwise calculate from start time
    if (info.duration !== undefined) {
      this.performanceMonitor.recordTest(info.testId, info.duration);
    } else {
      this.performanceMonitor.endTest(info.testId);
    }

    const result: TestResult = {
      testId: info.testId,
      name: info.name,
      status: info.status,
      duration: info.duration,
    };

    this.analytics.recordTestResult(result);

    if (info.status === 'passed') {
      this.logger.logTestSuccess(info.testId, { duration: info.duration });
    }

    this.notifyUpdate({ event: 'testEnd', data: info });
  }

  onTestFailure(info: TestFailureInfo): void {
    const category = this.categorizor.categorize(info.error);
    const context = this.debugger.getFailureContext(info.error, {
      testId: info.testId,
      name: info.name,
    });

    this.logger.logTestFailure(info.testId, info.error, {
      category: category.type,
      suggestions: category.recommendations,
    });

    const result: TestResult = {
      testId: info.testId,
      name: info.name,
      status: 'failed',
      duration: info.duration,
      error: info.error,
      category: category.type,
    };

    this.analytics.recordTestResult(result);

    this.notifyUpdate({
      event: 'testFailure',
      data: { ...info, category, context },
    });
  }

  generateReport(): TestReport {
    return this.reporter.generateReport();
  }

  getBottlenecks(): Array<{
    testId: string;
    duration: number;
    threshold: number;
  }> {
    return this.performanceMonitor.getBottlenecks({ threshold: 1000 });
  }

  onUpdate(callback: (data: unknown) => void): void {
    this.updateCallbacks.push(callback);
  }

  cleanup(): void {
    this.analytics.clear();
    this.performanceMonitor.clear();
    this.categorizor.clear();
    this.updateCallbacks = [];
  }

  private notifyUpdate(data: unknown): void {
    this.updateCallbacks.forEach((callback) => callback(data));
  }
}
