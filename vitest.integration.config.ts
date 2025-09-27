import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['src/__tests__/integration/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage/integration',
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        'src/__tests__/**',
        'agents/**',
      ],
      thresholds: {
        global: {
          lines: 60,  // Lower thresholds for integration tests
          functions: 60,
          branches: 50,
          statements: 60,
        },
      },
    },
    testTimeout: 30000, // Longer timeout for integration tests
    include: ['src/__tests__/integration/**/*.integration.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    // Run integration tests sequentially to avoid conflicts
    sequence: {
      concurrent: false,
    },
    // Isolate each test file
    isolate: true,
    // More detailed output for debugging
    reporter: ['verbose'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});