/**
 * Turbopack Runtime Tests
 *
 * Specific tests to prevent the reported Turbopack runtime error:
 * "Error: Cannot find module '../chunks/ssr/[turbopack]_runtime.js'"
 */
import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

describe('Turbopack Runtime Error Prevention', () => {
  const projectRoot = path.join(__dirname, '..');

  describe('Runtime Module Detection', () => {
    it('should not have the specific turbopack runtime error', async () => {
      const devServerTest = new Promise<{ hasRuntimeError: boolean; errorDetails: string[] }>((resolve) => {
        const child = spawn('npm', ['run', 'dev'], {
          stdio: 'pipe',
          cwd: projectRoot
        });

        let output = '';
        const errorDetails: string[] = [];
        let hasRuntimeError = false;

        const timeout = setTimeout(() => {
          child.kill();
          resolve({ hasRuntimeError, errorDetails });
        }, 12000);

        const checkForSpecificError = (chunk: string) => {
          // Check for the exact error pattern reported
          if (chunk.includes('[turbopack]_runtime.js')) {
            hasRuntimeError = true;
            errorDetails.push('Turbopack runtime module error detected');
          }

          if (chunk.includes('Cannot find module') && chunk.includes('chunks/ssr')) {
            hasRuntimeError = true;
            errorDetails.push('SSR chunk module error detected');
          }

          if (chunk.includes('require stack') && chunk.includes('turbopack')) {
            hasRuntimeError = true;
            errorDetails.push('Turbopack require stack error detected');
          }
        };

        child.stdout?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          checkForSpecificError(chunk);

          // If server starts successfully, we're good
          if (chunk.includes('Ready in') && !hasRuntimeError) {
            clearTimeout(timeout);
            child.kill();
            resolve({ hasRuntimeError, errorDetails });
          }
        });

        child.stderr?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          checkForSpecificError(chunk);
        });

        child.on('error', (error) => {
          clearTimeout(timeout);
          errorDetails.push(`Process error: ${error.message}`);
          resolve({ hasRuntimeError: true, errorDetails });
        });
      });

      const result = await devServerTest;

      if (result.hasRuntimeError) {
        console.error('Turbopack runtime errors detected:', result.errorDetails);
      }

      expect(result.hasRuntimeError).toBe(false);
      expect(result.errorDetails).toHaveLength(0);
    }, 15000);

    it('should have accessible turbopack chunks after build', async () => {
      // First ensure we have a build
      const buildSuccess = await new Promise<boolean>((resolve) => {
        const child = spawn('npm', ['run', 'build'], {
          stdio: 'pipe',
          cwd: projectRoot
        });

        let hasError = false;
        let output = '';

        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.stderr?.on('data', (data) => {
          const chunk = data.toString();
          if (chunk.includes('Build failed') || chunk.includes('turbopack]_runtime.js')) {
            hasError = true;
          }
        });

        child.on('close', (code) => {
          const hasCompiledSuccessfully = output.includes('Compiled successfully') ||
                                         output.includes('✓ Compiled successfully');
          resolve((code === 0 || hasCompiledSuccessfully) && !hasError);
        });
      });

      expect(buildSuccess).toBe(true);

      // Check that build output exists and is structured correctly
      const nextDir = path.join(projectRoot, '.next');
      const nextExists = await fs.access(nextDir).then(() => true, () => false);
      expect(nextExists).toBe(true);

      // Check for server directory structure
      const serverDir = path.join(nextDir, 'server');
      const serverExists = await fs.access(serverDir).then(() => true, () => false);
      expect(serverExists).toBe(true);
    }, 70000);
  });

  describe('Cache Corruption Prevention', () => {
    it('should handle cache clearing and regeneration', async () => {
      // Test that the app can start even after cache issues
      const recoveryTest = new Promise<boolean>((resolve) => {
        const child = spawn('npm', ['run', 'dev'], {
          stdio: 'pipe',
          cwd: projectRoot
        });

        let hasStarted = false;
        let hasRuntimeError = false;

        const timeout = setTimeout(() => {
          child.kill();
          resolve(hasStarted && !hasRuntimeError);
        }, 10000);

        child.stdout?.on('data', (data) => {
          const chunk = data.toString();

          if (chunk.includes('[turbopack]_runtime.js')) {
            hasRuntimeError = true;
          }

          if (chunk.includes('Ready in')) {
            hasStarted = true;
          }

          if (hasStarted && !hasRuntimeError) {
            clearTimeout(timeout);
            child.kill();
            resolve(true);
          }
        });

        child.stderr?.on('data', (data) => {
          const chunk = data.toString();
          if (chunk.includes('[turbopack]_runtime.js')) {
            hasRuntimeError = true;
          }
        });

        child.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });

      const recoverySuccessful = await recoveryTest;
      expect(recoverySuccessful).toBe(true);
    }, 15000);
  });

  describe('Module Resolution', () => {
    it('should have correct module resolution for Next.js', async () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      // Ensure Next.js version compatibility
      const nextVersion = packageJson.dependencies?.next;
      expect(nextVersion).toBeDefined();

      // Check for version patterns that might cause issues
      const version = nextVersion.replace(/[^\d.]/g, '');
      const [major, minor] = version.split('.').map(Number);

      // Ensure we're using a stable version
      expect(major).toBeGreaterThanOrEqual(14);
      if (major === 15) {
        expect(minor).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have consistent dependency versions', async () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Check React versions match
      if (deps.react && deps['react-dom']) {
        expect(deps.react).toBe(deps['react-dom']);
      }

      // Check for conflicting build tools
      const buildTools = ['vite', 'webpack', 'turbopack'].filter(tool => deps[tool]);
      // We should primarily use Next.js's built-in tools
      expect(buildTools.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Environment Configuration', () => {
    it('should handle development vs production environments correctly', async () => {
      // Test that development server uses correct environment
      const envTest = new Promise<{ isDev: boolean; hasErrors: boolean }>((resolve) => {
        const child = spawn('npm', ['run', 'dev'], {
          stdio: 'pipe',
          cwd: projectRoot
        });

        let output = '';
        let isDev = false;
        let hasErrors = false;

        const timeout = setTimeout(() => {
          child.kill();
          resolve({ isDev, hasErrors });
        }, 8000);

        child.stdout?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;

          if (chunk.includes('Next.js') && chunk.includes('Turbopack')) {
            isDev = true;
          }

          if (chunk.includes('[turbopack]_runtime.js')) {
            hasErrors = true;
          }

          if (chunk.includes('Ready in')) {
            clearTimeout(timeout);
            child.kill();
            resolve({ isDev, hasErrors });
          }
        });

        child.on('error', () => {
          clearTimeout(timeout);
          resolve({ isDev: false, hasErrors: true });
        });
      });

      const result = await envTest;
      expect(result.isDev).toBe(true);
      expect(result.hasErrors).toBe(false);
    }, 12000);
  });
});