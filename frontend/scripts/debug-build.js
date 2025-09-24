#!/usr/bin/env node

/**
 * Build Debug Utility
 *
 * A utility script to diagnose and fix common build issues,
 * especially Turbopack-related problems.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class BuildDebugger {
  constructor() {
    this.projectRoot = process.cwd();
    this.issues = [];
    this.fixes = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().slice(11, 19);
    const prefix = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      fix: '🔧'
    }[type] || '📋';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async checkFileExists(filePath) {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async checkPackageJson() {
    this.log('Checking package.json configuration...');

    const packagePath = path.join(this.projectRoot, 'package.json');

    if (!(await this.checkFileExists(packagePath))) {
      this.issues.push('Missing package.json file');
      return false;
    }

    try {
      const packageContent = await fs.promises.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      // Check critical scripts
      if (!packageJson.scripts?.dev) {
        this.issues.push('Missing dev script in package.json');
      } else if (!packageJson.scripts.dev.includes('turbopack')) {
        this.log('Dev script does not use Turbopack', 'warning');
      }

      // Check critical dependencies
      const requiredDeps = ['next', 'react', 'react-dom'];
      for (const dep of requiredDeps) {
        if (!packageJson.dependencies?.[dep]) {
          this.issues.push(`Missing required dependency: ${dep}`);
        }
      }

      // Check for version conflicts
      const nextVersion = packageJson.dependencies?.next;
      const reactVersion = packageJson.dependencies?.react;

      if (nextVersion && reactVersion) {
        const nextMajor = parseInt(nextVersion.match(/(\d+)/)?.[1] || '0');
        const reactMajor = parseInt(reactVersion.match(/(\d+)/)?.[1] || '0');

        if (nextMajor >= 15 && reactMajor < 18) {
          this.issues.push(`Next.js ${nextMajor} requires React 18+, but React ${reactMajor} is installed`);
          this.fixes.push('Update React to version 18+ to be compatible with Next.js 15+');
        }
      }

      this.log('package.json check completed', 'success');
      return true;
    } catch (error) {
      this.issues.push(`Invalid package.json: ${error.message}`);
      return false;
    }
  }

  async checkNextConfig() {
    this.log('Checking Next.js configuration...');

    const configPaths = [
      path.join(this.projectRoot, 'next.config.js'),
      path.join(this.projectRoot, 'next.config.ts'),
      path.join(this.projectRoot, 'next.config.mjs')
    ];

    let configExists = false;
    for (const configPath of configPaths) {
      if (await this.checkFileExists(configPath)) {
        configExists = true;

        try {
          // For TypeScript configs, we can at least check basic syntax
          const configContent = await fs.promises.readFile(configPath, 'utf-8');

          if (configContent.includes('output: "standalone"')) {
            this.log('Standalone output detected - good for deployment', 'info');
          }

          if (configContent.includes('typescript:') && configContent.includes('ignoreBuildErrors: true')) {
            this.log('TypeScript errors are being ignored - this may hide issues', 'warning');
          }

          this.log(`Found configuration at ${path.basename(configPath)}`, 'success');
        } catch (error) {
          this.issues.push(`Error reading ${configPath}: ${error.message}`);
        }
        break;
      }
    }

    if (!configExists) {
      this.log('No Next.js config found - using defaults', 'warning');
    }

    return configExists;
  }

  async checkNodeModules() {
    this.log('Checking node_modules integrity...');

    const nodeModulesPath = path.join(this.projectRoot, 'node_modules');

    if (!(await this.checkFileExists(nodeModulesPath))) {
      this.issues.push('node_modules directory not found');
      this.fixes.push('Run "npm install" to install dependencies');
      return false;
    }

    // Check for critical Next.js files
    const nextPath = path.join(nodeModulesPath, 'next');
    if (!(await this.checkFileExists(nextPath))) {
      this.issues.push('Next.js not found in node_modules');
      this.fixes.push('Reinstall Next.js with "npm install next"');
      return false;
    }

    // Check for package-lock.json vs pnpm-lock.yaml vs yarn.lock
    const lockFiles = [
      { file: 'package-lock.json', manager: 'npm' },
      { file: 'pnpm-lock.yaml', manager: 'pnpm' },
      { file: 'yarn.lock', manager: 'yarn' }
    ];

    const presentLockFiles = [];
    for (const { file, manager } of lockFiles) {
      if (await this.checkFileExists(path.join(this.projectRoot, file))) {
        presentLockFiles.push({ file, manager });
      }
    }

    if (presentLockFiles.length > 1) {
      this.log('Multiple lock files detected - this can cause dependency conflicts', 'warning');
      this.log(`Found: ${presentLockFiles.map(l => l.file).join(', ')}`, 'warning');
      this.fixes.push('Remove extra lock files and stick to one package manager');
    } else if (presentLockFiles.length === 1) {
      this.log(`Using ${presentLockFiles[0].manager} package manager`, 'info');
    }

    this.log('node_modules check completed', 'success');
    return true;
  }

  async checkCacheDirectories() {
    this.log('Checking cache directories...');

    const cacheDirectories = [
      { path: '.next', description: 'Next.js build cache' },
      { path: 'node_modules/.cache', description: 'Node modules cache' },
      { path: '.turbo', description: 'Turbopack cache' }
    ];

    for (const { path: dirPath, description } of cacheDirectories) {
      const fullPath = path.join(this.projectRoot, dirPath);
      if (await this.checkFileExists(fullPath)) {
        this.log(`Found ${description} at ${dirPath}`, 'info');

        // Check if cache is very large (potential corruption)
        try {
          const stats = await fs.promises.stat(fullPath);
          if (stats.isDirectory()) {
            this.log(`Cache directory size check for ${dirPath}`, 'info');
          }
        } catch (error) {
          this.log(`Could not check ${dirPath}: ${error.message}`, 'warning');
        }
      }
    }
  }

  async testDevServer() {
    this.log('Testing development server startup...');

    return new Promise((resolve) => {
      const child = spawn('npm', ['run', 'dev'], {
        stdio: 'pipe',
        cwd: this.projectRoot
      });

      let output = '';
      let hasError = false;
      let isReady = false;

      const timeout = setTimeout(() => {
        child.kill();
        if (!isReady) {
          this.issues.push('Development server failed to start within timeout');
          this.log('Dev server startup timed out', 'error');
        }
        resolve(!hasError && isReady);
      }, 15000);

      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;

        if (chunk.includes('Ready in')) {
          isReady = true;
          this.log('Development server started successfully', 'success');
          clearTimeout(timeout);
          child.kill();
          resolve(true);
        }

        if (chunk.includes('[turbopack]_runtime.js') ||
            (chunk.includes('Cannot find module') && chunk.includes('turbopack'))) {
          hasError = true;
          this.issues.push('Turbopack runtime module error detected');
          this.fixes.push('Clear .next cache and restart development server');
          this.log('Turbopack runtime error detected', 'error');
        }
      });

      child.stderr?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;

        if (chunk.includes('Error:') || chunk.includes('Cannot find module')) {
          hasError = true;
          this.log(`Error detected: ${chunk.trim()}`, 'error');
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        this.issues.push(`Failed to start dev server: ${error.message}`);
        this.log(`Process error: ${error.message}`, 'error');
        resolve(false);
      });
    });
  }

  async suggestFixes() {
    if (this.issues.length === 0) {
      this.log('No issues detected!', 'success');
      return;
    }

    this.log('\n🔍 ISSUES DETECTED:', 'error');
    this.issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue}`);
    });

    if (this.fixes.length > 0) {
      this.log('\n🔧 SUGGESTED FIXES:', 'fix');
      this.fixes.forEach((fix, index) => {
        console.log(`  ${index + 1}. ${fix}`);
      });
    }

    // Common universal fixes
    this.log('\n💡 GENERAL TROUBLESHOOTING STEPS:', 'info');
    console.log('  1. Clear all caches: rm -rf .next node_modules/.cache .turbo');
    console.log('  2. Reinstall dependencies: rm -rf node_modules package-lock.json && npm install');
    console.log('  3. Check for port conflicts: kill processes using port 3000');
    console.log('  4. Update dependencies: npm update');
    console.log('  5. Check Node.js version: node --version (should be 18+)');
  }

  async run() {
    this.log('🚀 Starting build diagnostics...\n');

    await this.checkPackageJson();
    await this.checkNextConfig();
    await this.checkNodeModules();
    await this.checkCacheDirectories();

    this.log('\n🧪 Testing development server...');
    await this.testDevServer();

    this.log('\n📋 DIAGNOSTIC RESULTS:');
    await this.suggestFixes();
  }
}

// Run diagnostics if called directly
if (require.main === module) {
  const buildDebugger = new BuildDebugger();
  buildDebugger.run().catch(error => {
    console.error('❌ Diagnostic failed:', error.message);
    process.exit(1);
  });
}

module.exports = BuildDebugger;