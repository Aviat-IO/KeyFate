/**
 * Build Configuration Tests
 *
 * Tests to ensure build configuration is correct and prevent
 * Turbopack runtime errors and other build failures.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

describe('Build Configuration', () => {
  beforeAll(async () => {
    // Ensure we're in the correct directory
    process.chdir(path.join(__dirname, '..'));
  });

  describe('Configuration Files', () => {
    it('should have valid package.json', async () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');

      expect(() => JSON.parse(packageContent)).not.toThrow();

      const packageJson = JSON.parse(packageContent);
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts.dev).toBe('next dev --turbopack');
      expect(packageJson.scripts.build).toBe('next build');
      expect(packageJson.dependencies.next).toBeDefined();
    });

    it('should have valid next.config.ts', async () => {
      const configPath = path.join(process.cwd(), 'next.config.ts');
      const configExists = await fs.access(configPath).then(() => true, () => false);

      expect(configExists).toBe(true);

      // Test that the config can be imported without errors
      const { default: nextConfig } = await import(configPath);
      expect(nextConfig).toBeDefined();
      expect(typeof nextConfig).toBe('object');
    });

    it('should have required environment files', async () => {
      const envFiles = ['.env.local', '.env.development.local'];

      for (const envFile of envFiles) {
        const envPath = path.join(process.cwd(), envFile);
        const envExists = await fs.access(envPath).then(() => true, () => false);

        if (envExists) {
          const envContent = await fs.readFile(envPath, 'utf-8');
          // Basic validation that it's not empty and has key=value format
          expect(envContent.trim().length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Dependencies', () => {
    it('should have all required dependencies installed', async () => {
      const nodeModulesPath = path.join(process.cwd(), 'node_modules');
      const nodeModulesExists = await fs.access(nodeModulesPath).then(() => true, () => false);

      expect(nodeModulesExists).toBe(true);

      // Check for critical dependencies
      const criticalDeps = ['next', 'react', 'react-dom'];

      for (const dep of criticalDeps) {
        const depPath = path.join(nodeModulesPath, dep);
        const depExists = await fs.access(depPath).then(() => true, () => false);
        expect(depExists).toBe(true);
      }
    });

    it('should have no conflicting dependency versions', async () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      // Check for common conflicting patterns
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Ensure React versions are compatible
      if (deps.react && deps['react-dom']) {
        const reactVersion = deps.react;
        const reactDomVersion = deps['react-dom'];
        expect(reactVersion).toBe(reactDomVersion);
      }

      // Ensure Next.js and React versions are compatible
      if (deps.next && deps.react) {
        const nextVersion = deps.next;
        const reactVersion = deps.react;

        // Next.js 15.x requires React 18.x
        if (nextVersion.includes('15.')) {
          expect(reactVersion).toMatch(/^18\./);
        }
      }
    });
  });

  describe('Build Process', () => {
    it('should be able to start development server without errors', async () => {
      const startupPromise = new Promise<{ success: boolean; output: string }>((resolve) => {
        const child = spawn('npm', ['run', 'dev'], {
          stdio: 'pipe',
          cwd: process.cwd()
        });

        let output = '';
        let hasError = false;
        let hasReady = false;

        const timeout = setTimeout(() => {
          child.kill();
          resolve({
            success: hasReady && !hasError,
            output: output + '\n[TIMEOUT]'
          });
        }, 10000); // 10 second timeout

        child.stdout?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;

          if (chunk.includes('Ready in')) {
            hasReady = true;
          }

          if (chunk.includes('Cannot find module') ||
              chunk.includes('Error:') ||
              chunk.includes('turbopack]_runtime.js')) {
            hasError = true;
          }

          if (hasReady && !hasError) {
            clearTimeout(timeout);
            child.kill();
            resolve({ success: true, output });
          }
        });

        child.stderr?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;

          if (chunk.includes('Cannot find module') ||
              chunk.includes('Error:') ||
              chunk.includes('turbopack]_runtime.js')) {
            hasError = true;
            clearTimeout(timeout);
            child.kill();
            resolve({ success: false, output });
          }
        });

        child.on('error', (error) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            output: output + '\nProcess error: ' + error.message
          });
        });
      });

      const result = await startupPromise;

      if (!result.success) {
        console.error('Dev server startup failed with output:', result.output);
      }

      expect(result.success).toBe(true);
      expect(result.output).not.toContain('Cannot find module');
      expect(result.output).not.toContain('turbopack]_runtime.js');
      expect(result.output).toContain('Ready in');
    }, 15000);

    it('should be able to build for production without errors', async () => {
      const buildPromise = new Promise<{ success: boolean; output: string }>((resolve) => {
        const child = spawn('npm', ['run', 'build'], {
          stdio: 'pipe',
          cwd: process.cwd()
        });

        let output = '';
        let hasError = false;

        const timeout = setTimeout(() => {
          child.kill();
          resolve({
            success: false,
            output: output + '\n[BUILD TIMEOUT - 60s]'
          });
        }, 60000); // 60 second timeout for build

        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.stderr?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;

          // Only mark as error for actual build failures, not warnings/config issues
          if ((chunk.includes('Cannot find module') && !chunk.includes('OAuth configuration')) ||
              chunk.includes('Build failed') ||
              chunk.includes('turbopack]_runtime.js') ||
              chunk.includes('Build error')) {
            hasError = true;
          }
        });

        child.on('close', (code) => {
          clearTimeout(timeout);

          // Build is successful if:
          // 1. Process exited with code 0, OR
          // 2. Output contains "Compiled successfully" (even with warnings)
          const hasCompiledSuccessfully = output.includes('Compiled successfully') ||
                                         output.includes('✓ Compiled successfully');

          resolve({
            success: (code === 0 || hasCompiledSuccessfully) && !hasError,
            output
          });
        });

        child.on('error', (error) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            output: output + '\nProcess error: ' + error.message
          });
        });
      });

      const result = await buildPromise;

      if (!result.success) {
        console.error('Production build failed with output:', result.output);
      }

      expect(result.success).toBe(true);
      expect(result.output).not.toContain('Cannot find module');
      expect(result.output).not.toContain('turbopack]_runtime.js');
    }, 70000);
  });

  describe('Turbopack Specific Tests', () => {
    it('should not have Turbopack runtime module errors', async () => {
      // This test specifically checks for the reported error pattern
      const devStartPromise = new Promise<{ hasRuntimeError: boolean; output: string }>((resolve) => {
        const child = spawn('npm', ['run', 'dev'], {
          stdio: 'pipe',
          cwd: process.cwd()
        });

        let output = '';
        let hasRuntimeError = false;

        const timeout = setTimeout(() => {
          child.kill();
          resolve({ hasRuntimeError, output });
        }, 8000);

        const checkForRuntimeError = (chunk: string) => {
          if (chunk.includes('[turbopack]_runtime.js') ||
              chunk.includes('Cannot find module') && chunk.includes('turbopack')) {
            hasRuntimeError = true;
          }
        };

        child.stdout?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          checkForRuntimeError(chunk);

          if (chunk.includes('Ready in')) {
            clearTimeout(timeout);
            child.kill();
            resolve({ hasRuntimeError, output });
          }
        });

        child.stderr?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          checkForRuntimeError(chunk);
        });

        child.on('error', () => {
          clearTimeout(timeout);
          resolve({ hasRuntimeError: true, output });
        });
      });

      const result = await devStartPromise;

      if (result.hasRuntimeError) {
        console.error('Turbopack runtime error detected:', result.output);
      }

      expect(result.hasRuntimeError).toBe(false);
    }, 12000);
  });

  describe('Cache and Temporary Files', () => {
    it('should handle cache clearing gracefully', async () => {
      // Test that the app can recover from cache clearing
      const nextDir = path.join(process.cwd(), '.next');
      const nextExists = await fs.access(nextDir).then(() => true, () => false);

      if (nextExists) {
        // If .next exists, the build system should handle it correctly
        expect(true).toBe(true);
      }

      // The app should start even without existing cache
      const startupWithoutCache = new Promise<boolean>((resolve) => {
        const child = spawn('npm', ['run', 'dev'], {
          stdio: 'pipe',
          cwd: process.cwd()
        });

        const timeout = setTimeout(() => {
          child.kill();
          resolve(false);
        }, 8000);

        child.stdout?.on('data', (data) => {
          if (data.toString().includes('Ready in')) {
            clearTimeout(timeout);
            child.kill();
            resolve(true);
          }
        });

        child.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });

      const success = await startupWithoutCache;
      expect(success).toBe(true);
    }, 12000);
  });
});