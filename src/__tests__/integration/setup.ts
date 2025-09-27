import { beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { vi } from 'vitest';

// Integration test setup - creates isolated test environment
const TEST_DATA_DIR = path.join(process.cwd(), 'test-data');
const TEST_TOKEN_DIR = path.join(TEST_DATA_DIR, 'tokens');
const TEST_BACKUP_DIR = path.join(TEST_DATA_DIR, 'backups');
const TEST_STORAGE_DIR = path.join(TEST_DATA_DIR, 'storage');
const TEST_TEMP_DIR = path.join(TEST_DATA_DIR, 'temp');

// Mock environment variables for testing
const TEST_ENV = {
  NODE_ENV: 'test',
  YOUTUBE_CLIENT_ID: 'test-client-id',
  YOUTUBE_CLIENT_SECRET: 'test-client-secret',
  YOUTUBE_REDIRECT_URI: 'http://localhost:3000/callback',
  OAUTH_ENCRYPTION_SECRET: 'test-encryption-secret-32-chars-long',
  LOG_LEVEL: 'error', // Minimize logging during tests
  // Override directories to use test directories
  TOKEN_STORAGE_DIR: TEST_TOKEN_DIR,
  BACKUP_DIR: TEST_BACKUP_DIR,
  STORAGE_DIR: TEST_STORAGE_DIR,
  TEMP_DIR: TEST_TEMP_DIR,
};

// Set up test environment variables
beforeAll(async () => {
  // Store original environment
  (globalThis as any).__originalEnv = { ...process.env };

  // Set test environment variables
  Object.assign(process.env, TEST_ENV);

  // Create test directories
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  await fs.mkdir(TEST_TOKEN_DIR, { recursive: true });
  await fs.mkdir(TEST_BACKUP_DIR, { recursive: true });
  await fs.mkdir(TEST_STORAGE_DIR, { recursive: true });
  await fs.mkdir(TEST_TEMP_DIR, { recursive: true });

  // Mock console methods to prevent noise during tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Clean up before each test
beforeEach(async () => {
  // Clear test directories
  await clearDirectory(TEST_TOKEN_DIR);
  await clearDirectory(TEST_BACKUP_DIR);
  await clearDirectory(TEST_STORAGE_DIR);
  await clearDirectory(TEST_TEMP_DIR);

  // Reset all mocks
  vi.clearAllMocks();
});

// Clean up after each test
afterEach(async () => {
  // Additional cleanup if needed
  vi.clearAllTimers();
});

// Restore environment after all tests
afterAll(async () => {
  // Restore original environment
  const originalEnv = (globalThis as any).__originalEnv;
  if (originalEnv) {
    process.env = originalEnv;
  }

  // Clean up test directories
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }

  // Restore console methods
  vi.restoreAllMocks();
});

// Utility function to clear directory contents
async function clearDirectory(dirPath: string): Promise<void> {
  try {
    const files = await fs.readdir(dirPath);
    await Promise.all(
      files.map(file =>
        fs.rm(path.join(dirPath, file), { recursive: true, force: true })
      )
    );
  } catch (error) {
    // Directory might not exist, ignore
  }
}

// Export test utilities
export { TEST_DATA_DIR, TEST_TOKEN_DIR, TEST_BACKUP_DIR, TEST_STORAGE_DIR, TEST_TEMP_DIR };

// Global test configuration
export const TEST_CONFIG = {
  MCP_SERVER_NAME: 'youtube-mcp-extended-test',
  MCP_SERVER_VERSION: '0.0.2-test',
  YOUTUBE_API_QUOTA_LIMIT: 100, // Low limit for testing
  YOUTUBE_API_RATE_LIMIT_RPS: 1, // Slow rate for testing
  YOUTUBE_API_RATE_LIMIT_RPM: 10,
  TEST_TIMEOUT: 5000,
  BATCH_TIMEOUT: 10000,
};