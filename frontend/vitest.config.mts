import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["__tests__/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{js,ts,jsx,tsx}",
      "__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}",
    ],
    // Suppress React act() warnings and API error logs in tests
    onConsoleLog(log, type) {
      if (
        log.includes(
          "Warning: An update to TestComponent inside a test was not wrapped in act",
        )
      ) {
        return false;
      }
      // Suppress expected API error logs during testing
      if (
        type === "stderr" &&
        (log.includes("[POST /api/secrets") ||
          log.includes("[CreateSecret") ||
          log.includes("Error:") ||
          log.includes("SyntaxError:"))
      ) {
        return false;
      }
    },
  },
});
