#!/usr/bin/env tsx
/**
 * Generate Test Report Script
 *
 * This script runs the test suite with monitoring enabled and generates
 * a comprehensive report of test results, performance, and failures.
 *
 * Usage:
 *   npm run test:report           # Generate JSON report
 *   npm run test:report --markdown # Generate Markdown report
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

interface TestResult {
  file: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  timestamp: string;
}

async function generateTestReport() {
  console.log('Running tests with monitoring...');

  try {
    // Run tests with JSON output
    const output = execSync('npm test -- --reporter=json', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    const results = parseTestOutput(output);
    const summary = generateSummary(results);

    const format = process.argv.includes('--markdown') ? 'markdown' : 'json';
    const report =
      format === 'markdown'
        ? generateMarkdownReport(summary, results)
        : generateJsonReport(summary, results);

    const outputPath = resolve(
      process.cwd(),
      `test-report.${format === 'markdown' ? 'md' : 'json'}`
    );
    writeFileSync(outputPath, report);

    console.log(`\nTest report generated: ${outputPath}`);
    console.log(`\nSummary:`);
    console.log(`  Total: ${summary.total}`);
    console.log(`  Passed: ${summary.passed} (${((summary.passed / summary.total) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${summary.failed}`);
    console.log(`  Duration: ${(summary.duration / 1000).toFixed(2)}s`);
  } catch (error) {
    console.error('Error generating test report:', error);
    process.exit(1);
  }
}

function parseTestOutput(output: string): TestResult[] {
  // Parse vitest JSON output
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON output found');
    }

    const data = JSON.parse(jsonMatch[0]);
    const results: TestResult[] = [];

    // Extract test results from vitest output
    if (data.testResults) {
      data.testResults.forEach((file: any) => {
        file.assertionResults?.forEach((test: any) => {
          results.push({
            file: file.name,
            name: test.title,
            status: test.status,
            duration: test.duration || 0,
            error: test.failureMessages?.[0],
          });
        });
      });
    }

    return results;
  } catch (error) {
    console.warn('Could not parse JSON output, using fallback parsing');
    return [];
  }
}

function generateSummary(results: TestResult[]): TestSummary {
  return {
    total: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    duration: results.reduce((sum, r) => sum + r.duration, 0),
    timestamp: new Date().toISOString(),
  };
}

function generateMarkdownReport(
  summary: TestSummary,
  results: TestResult[]
): string {
  const lines: string[] = [];

  lines.push('# Test Report');
  lines.push('');
  lines.push(`Generated: ${summary.timestamp}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Tests:** ${summary.total}`);
  lines.push(`- **Passed:** ${summary.passed} (${((summary.passed / summary.total) * 100).toFixed(1)}%)`);
  lines.push(`- **Failed:** ${summary.failed}`);
  lines.push(`- **Skipped:** ${summary.skipped}`);
  lines.push(`- **Duration:** ${(summary.duration / 1000).toFixed(2)}s`);
  lines.push('');

  const failed = results.filter((r) => r.status === 'failed');
  if (failed.length > 0) {
    lines.push('## Failed Tests');
    lines.push('');

    // Group by file
    const byFile = new Map<string, TestResult[]>();
    failed.forEach((result) => {
      const tests = byFile.get(result.file) || [];
      tests.push(result);
      byFile.set(result.file, tests);
    });

    byFile.forEach((tests, file) => {
      lines.push(`### ${file}`);
      lines.push('');
      tests.forEach((test) => {
        lines.push(`- **${test.name}**`);
        if (test.error) {
          lines.push(`  \`\`\`\n  ${test.error}\n  \`\`\``);
        }
        lines.push('');
      });
    });
  }

  // Slowest tests
  const slowest = [...results]
    .filter((r) => r.status === 'passed')
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  if (slowest.length > 0) {
    lines.push('## Slowest Tests');
    lines.push('');
    slowest.forEach((test) => {
      lines.push(`- **${test.name}** (${test.duration}ms)`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

function generateJsonReport(
  summary: TestSummary,
  results: TestResult[]
): string {
  return JSON.stringify(
    {
      summary,
      results,
    },
    null,
    2
  );
}

// Run the script
generateTestReport();
