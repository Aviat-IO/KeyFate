#!/usr/bin/env tsx
/**
 * Database Query Security Audit Script
 *
 * Scans all API routes and service files for database queries
 * and validates that proper user filtering is applied to prevent
 * cross-user data access after RLS policy removal.
 *
 * Usage: npx tsx scripts/audit-database-queries.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface QueryAuditResult {
  file: string;
  line: number;
  query: string;
  table: string;
  hasUserFilter: boolean;
  filterType: 'userId' | 'secretOwnership' | 'tokenOwnership' | 'none';
  severity: 'critical' | 'warning' | 'info' | 'pass';
  message: string;
}

interface AuditSummary {
  totalFiles: number;
  totalQueries: number;
  critical: number;
  warnings: number;
  passed: number;
  results: QueryAuditResult[];
}

// Tables that MUST be filtered by userId
const USER_TABLES = [
  'secrets',
  'checkin_history',
  'user_subscriptions',
  'user_contact_methods',
  'payment_history',
];

// Tables that require ownership validation via join
const OWNERSHIP_TABLES = [
  'check_in_tokens',
  'reminder_jobs',
  'email_notifications',
];

// System tables that don't require user filtering (admin/cron only)
const SYSTEM_TABLES = [
  'email_failures',
  'admin_notifications',
  'webhook_events',
  'cron_config',
  'subscription_tiers',
];

// NextAuth tables (managed by framework)
const NEXTAUTH_TABLES = [
  'users',
  'accounts',
  'sessions',
  'verification_tokens',
];

/**
 * Check if a query contains user filtering
 */
function analyzeQuery(
  fileContent: string,
  filePath: string,
  lineNumber: number,
  queryText: string,
  table: string
): QueryAuditResult {
  const result: QueryAuditResult = {
    file: filePath,
    line: lineNumber,
    query: queryText.substring(0, 100), // Truncate for readability
    table,
    hasUserFilter: false,
    filterType: 'none',
    severity: 'info',
    message: '',
  };

  // Check if this is a cron endpoint (system queries allowed)
  if (filePath.includes('/api/cron/')) {
    result.severity = 'info';
    result.message = 'System cron endpoint - no user filter required';
    return result;
  }

  // Check if this is an INSERT operation (userId in data, not WHERE clause)
  if (/\.insert\(/.test(queryText)) {
    result.severity = 'info';
    result.message = 'INSERT operation - userId included in data';
    return result;
  }

  // Check if this is a health check method
  if (/healthCheck/.test(queryText) || filePath.includes('/api/health/')) {
    result.severity = 'info';
    result.message = 'Health check - system query';
    return result;
  }

  // Check if this is check-in route (token-based auth, not session)
  if (filePath.includes('/api/check-in/route.ts')) {
    // Check if token was already validated
    const hasTokenValidation = /const \[tokenRow\] = await/.test(fileContent) &&
                               /eq\(checkInTokens\.token, token\)/.test(fileContent);
    if (hasTokenValidation) {
      result.severity = 'info';
      result.message = 'Check-in endpoint - token-based authentication';
      return result;
    }
  }

  // Check for userId filter patterns
  const hasUserIdFilter =
    /eq\(secrets\.userId,\s*(?:session\.user\.id|userId|user\.id)\)/.test(queryText) ||
    /eq\(\w+\.userId,\s*(?:session\.user\.id|userId|user\.id)\)/.test(queryText) ||
    /\.where\([^)]*userId[^)]*\)/.test(queryText);

  // Check for ownership validation via join
  const hasOwnershipJoin =
    /innerJoin\(secrets,\s*eq\(\w+\.secretId,\s*secrets\.id\)\)/.test(queryText) &&
    /eq\(secrets\.userId,\s*(?:session\.user\.id|userId|user\.id)\)/.test(queryText);

  // Check for token-based ownership validation
  const hasTokenValidation =
    /validateSecretOwnership/.test(fileContent.substring(Math.max(0, lineNumber - 50), lineNumber + 50)) ||
    /getById\(\w+,\s*(?:session\.user\.id|userId|user\.id)\)/.test(queryText);

  if (hasUserIdFilter) {
    result.hasUserFilter = true;
    result.filterType = 'userId';
    result.severity = 'pass';
    result.message = 'Properly filtered by userId';
  } else if (hasOwnershipJoin) {
    result.hasUserFilter = true;
    result.filterType = 'secretOwnership';
    result.severity = 'pass';
    result.message = 'Properly validated via secret ownership join';
  } else if (hasTokenValidation) {
    result.hasUserFilter = true;
    result.filterType = 'tokenOwnership';
    result.severity = 'pass';
    result.message = 'Ownership validated via service method';
  } else {
    // Determine severity based on table type
    if (USER_TABLES.includes(table)) {
      result.severity = 'critical';
      result.message = `CRITICAL: ${table} query missing userId filter`;
    } else if (OWNERSHIP_TABLES.includes(table)) {
      result.severity = 'warning';
      result.message = `WARNING: ${table} query should validate ownership via secret`;
    } else if (SYSTEM_TABLES.includes(table) || NEXTAUTH_TABLES.includes(table)) {
      result.severity = 'info';
      result.message = `INFO: System table ${table} - verify admin/system context`;
    } else {
      result.severity = 'warning';
      result.message = `WARNING: Unknown table ${table} - verify filtering requirements`;
    }
  }

  return result;
}

/**
 * Extract database queries from TypeScript file
 */
function extractQueries(filePath: string, content: string): QueryAuditResult[] {
  const results: QueryAuditResult[] = [];
  const lines = content.split('\n');

  // Patterns for database operations
  const patterns = [
    /\.select\(\)/g,
    /\.insert\(/g,
    /\.update\(/g,
    /\.delete\(/g,
    /db\.execute\(/g,
  ];

  lines.forEach((line, index) => {
    patterns.forEach(pattern => {
      if (pattern.test(line)) {
        // Find the table being queried
        const tableMatch = line.match(/\.from\((\w+)\)/) ||
                          line.match(/\.insert\((\w+)\)/) ||
                          line.match(/\.update\((\w+)\)/) ||
                          line.match(/\.delete\((\w+)\)/);

        if (tableMatch) {
          const table = tableMatch[1];

          // Get context around the query (up to 10 lines)
          const contextStart = Math.max(0, index - 5);
          const contextEnd = Math.min(lines.length, index + 10);
          const queryContext = lines.slice(contextStart, contextEnd).join('\n');

          const result = analyzeQuery(
            content,
            filePath,
            index + 1,
            queryContext,
            table
          );

          results.push(result);
        }
      }
    });
  });

  return results;
}

/**
 * Recursively scan directory for TypeScript files
 */
function scanDirectory(dir: string, baseDir: string): QueryAuditResult[] {
  let results: QueryAuditResult[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and build directories
      if (!['node_modules', '.next', 'dist', 'build'].includes(entry.name)) {
        results = results.concat(scanDirectory(fullPath, baseDir));
      }
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      // Only scan API routes and service files
      const relativePath = path.relative(baseDir, fullPath);
      if (
        relativePath.includes('src/app/api') ||
        relativePath.includes('src/lib/db') ||
        relativePath.includes('src/lib/services')
      ) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const fileResults = extractQueries(relativePath, content);
        results = results.concat(fileResults);
      }
    }
  }

  return results;
}

/**
 * Generate audit report
 */
function generateReport(results: QueryAuditResult[]): AuditSummary {
  const summary: AuditSummary = {
    totalFiles: new Set(results.map(r => r.file)).size,
    totalQueries: results.length,
    critical: results.filter(r => r.severity === 'critical').length,
    warnings: results.filter(r => r.severity === 'warning').length,
    passed: results.filter(r => r.severity === 'pass').length,
    results: results.sort((a, b) => {
      // Sort by severity: critical > warning > info > pass
      const severityOrder = { critical: 0, warning: 1, info: 2, pass: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
  };

  return summary;
}

/**
 * Print colored output
 */
function printReport(summary: AuditSummary) {
  console.log('\n=== DATABASE QUERY SECURITY AUDIT ===\n');

  console.log(`Files scanned: ${summary.totalFiles}`);
  console.log(`Queries analyzed: ${summary.totalQueries}`);
  console.log(`Critical issues: ${summary.critical}`);
  console.log(`Warnings: ${summary.warnings}`);
  console.log(`Passed: ${summary.passed}\n`);

  if (summary.critical > 0) {
    console.log('🚨 CRITICAL ISSUES:\n');
    summary.results
      .filter(r => r.severity === 'critical')
      .forEach(r => {
        console.log(`  ${r.file}:${r.line}`);
        console.log(`  Table: ${r.table}`);
        console.log(`  ${r.message}`);
        console.log(`  Query: ${r.query}...\n`);
      });
  }

  if (summary.warnings > 0) {
    console.log('⚠️  WARNINGS:\n');
    summary.results
      .filter(r => r.severity === 'warning')
      .forEach(r => {
        console.log(`  ${r.file}:${r.line}`);
        console.log(`  Table: ${r.table}`);
        console.log(`  ${r.message}\n`);
      });
  }

  console.log('✅ PASSED QUERIES:\n');
  summary.results
    .filter(r => r.severity === 'pass')
    .slice(0, 5) // Show first 5 examples
    .forEach(r => {
      console.log(`  ${r.file}:${r.line} - ${r.table} (${r.filterType})`);
    });

  if (summary.results.filter(r => r.severity === 'pass').length > 5) {
    console.log(`  ... and ${summary.results.filter(r => r.severity === 'pass').length - 5} more\n`);
  }

  // Save detailed report to file
  const reportPath = path.join(process.cwd(), 'audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);

  // Exit with error code if critical issues found
  if (summary.critical > 0) {
    console.log('\n❌ AUDIT FAILED: Critical security issues found');
    process.exit(1);
  } else if (summary.warnings > 0) {
    console.log('\n⚠️  AUDIT PASSED WITH WARNINGS: Review warnings before deployment');
    process.exit(0);
  } else {
    console.log('\n✅ AUDIT PASSED: All queries properly filtered');
    process.exit(0);
  }
}

/**
 * Main audit execution
 */
function main() {
  const projectRoot = process.cwd();
  console.log(`Scanning project: ${projectRoot}`);

  const results = scanDirectory(projectRoot, projectRoot);
  const summary = generateReport(results);
  printReport(summary);
}

// Run audit
main();
