import { beforeEach, vi } from 'vitest';

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();

  // Reset environment variables
  process.env.NODE_ENV = 'test';

  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Global test utilities
export const TestUtils = {
  // Helper to wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to create mock promises
  createMockPromise: <T>(value: T, delay: number = 0) =>
    new Promise<T>(resolve => setTimeout(() => resolve(value), delay)),

  // Helper to create rejected promises
  createRejectedPromise: (error: Error, delay: number = 0) =>
    new Promise((_, reject) => setTimeout(() => reject(error), delay)),
};