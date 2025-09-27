import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        'src/__tests__/**',
        'agents/**',
        'src/index.ts', // Main entry point - integration tested
      ],
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
      },
    },
    testTimeout: 10000,
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
