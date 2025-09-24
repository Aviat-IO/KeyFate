// Test setup file for claude-collective tests
// Configures test environment and global utilities

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { vi } from 'vitest';

// Set up test environment
global.console = {
  ...console,
  // Suppress console.log during tests unless explicitly needed
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
};

// Global test utilities
global.testUtils = {
  createMockAgent: (name, capabilities = []) => ({
    name,
    capabilities,
    status: 'active',
    lastUsed: new Date().toISOString()
  }),

  createMockHandoff: (from, to, context = {}) => ({
    from,
    to,
    context,
    timestamp: new Date().toISOString(),
    handoffId: `test_${Date.now()}`
  }),

  createMockContract: (preconditions = [], postconditions = []) => ({
    preconditions: preconditions.map(name => ({
      name,
      test: () => true,
      critical: true,
      errorMessage: `${name} validation failed`
    })),
    postconditions: postconditions.map(name => ({
      name,
      test: () => true,
      critical: false,
      errorMessage: `${name} validation failed`
    })),
    rollback: async () => ({ rolled_back: true })
  }),

  mockFileExists: (filePath, exists = true) => {
    vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
      return path === filePath ? exists : fs.existsSync(path);
    });
  },

  cleanup: () => {
    vi.restoreAllMocks();
  }
};

// Set up test directories with more robust path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testTempDir = path.join(__dirname, 'temp');

globalThis.beforeEach = globalThis.beforeEach || function(fn) {
  // Vitest globals will handle this
  if (typeof beforeEach !== 'undefined') beforeEach(fn);
};

globalThis.afterEach = globalThis.afterEach || function(fn) {
  // Vitest globals will handle this
  if (typeof afterEach !== 'undefined') afterEach(fn);
};

// Set up directories for each test
globalThis.beforeEach(() => {
  try {
    if (fs.existsSync(testTempDir)) {
      fs.removeSync(testTempDir);
    }
    // Ensure parent directory exists first
    fs.ensureDirSync(path.dirname(testTempDir));
    fs.ensureDirSync(testTempDir);
  } catch (error) {
    console.error('Failed to set up test temp directory:', error);
    // Fallback to a safe directory
    const fallbackDir = path.join(process.cwd(), 'tests', 'temp');
    fs.ensureDirSync(fallbackDir);
  }
});

globalThis.afterEach(() => {
  global.testUtils.cleanup();
  try {
    if (fs.existsSync(testTempDir)) {
      fs.removeSync(testTempDir);
    }
  } catch (error) {
    // Silent cleanup failure - not critical for tests
    console.warn('Failed to clean up test temp directory:', error.message);
  }
});