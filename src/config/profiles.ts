import {
  AppConfigSchema,
  type AppConfig,
  type Environment,
  type LogLevel,
} from './schemas.js';

/**
 * Base configuration that applies to all environments
 */
const baseConfig: Partial<AppConfig> = {
  mcpServer: {
    name: 'youtube-mcp-extended',
    version: '1.0.0',
    capabilities: {
      tools: { listChanged: true },
      resources: { listChanged: true, subscribe: true },
      prompts: { listChanged: false },
    },
  },
  youtubeAPI: {
    quotaLimit: 10000,
    rateLimitRequestsPerSecond: 100,
    rateLimitRequestsPerMinute: 6000,
    defaultPageSize: 25,
  },
  storage: {
    backupDir: 'backups',
    metadataSuggestionsDir: 'storage/metadata-suggestions',
    tempDir: 'temp',
  },
  security: {},
};

/**
 * Development environment configuration
 */
const developmentConfig: Partial<AppConfig> = {
  ...baseConfig,
  env: 'development',
  logging: {
    level: 'debug',
    enableConsole: true,
    enableFile: true,
    logDir: 'logs',
    maxFileSize: '10MB',
    maxFiles: 5,
  },
  youtubeAPI: {
    ...baseConfig.youtubeAPI,
    // More lenient rate limits for development
    rateLimitRequestsPerSecond: 50,
    rateLimitRequestsPerMinute: 3000,
  },
};

/**
 * Production environment configuration
 */
const productionConfig: Partial<AppConfig> = {
  ...baseConfig,
  env: 'production',
  logging: {
    level: 'info',
    enableConsole: false, // Disable console logging in production MCP servers
    enableFile: true,
    logDir: 'logs',
    maxFileSize: '50MB',
    maxFiles: 10,
  },
  youtubeAPI: {
    ...baseConfig.youtubeAPI,
    // Stricter rate limits for production to stay within quota
    rateLimitRequestsPerSecond: 80,
    rateLimitRequestsPerMinute: 4800,
  },
};

/**
 * Test environment configuration
 */
const testConfig: Partial<AppConfig> = {
  ...baseConfig,
  env: 'test',
  logging: {
    level: 'warn',
    enableConsole: false,
    enableFile: false,
    logDir: 'test-logs',
    maxFileSize: '5MB',
    maxFiles: 3,
  },
  youtubeAPI: {
    ...baseConfig.youtubeAPI,
    // Lower limits for testing
    rateLimitRequestsPerSecond: 10,
    rateLimitRequestsPerMinute: 600,
    defaultPageSize: 5,
  },
  storage: {
    backupDir: 'test-backups',
    metadataSuggestionsDir: 'test-storage/metadata-suggestions',
    tempDir: 'test-temp',
  },
};

/**
 * Configuration profiles mapped by environment
 */
const configProfiles: Record<Environment, Partial<AppConfig>> = {
  development: developmentConfig,
  production: productionConfig,
  test: testConfig,
};

/**
 * Get configuration profile for a specific environment
 */
export function getConfigProfile(env: Environment): Partial<AppConfig> {
  return configProfiles[env] || developmentConfig;
}

/**
 * Get default OAuth scopes based on environment
 */
export function getDefaultOAuthScopes(env: Environment): string[] {
  const baseScopes = [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.upload',
  ];

  if (env === 'development' || env === 'test') {
    // Add audit scope for development and testing
    return [
      ...baseScopes,
      'https://www.googleapis.com/auth/youtubepartner-channel-audit',
    ];
  }

  return baseScopes;
}

/**
 * Get default redirect URI based on environment
 */
export function getDefaultRedirectUri(env: Environment): string {
  switch (env) {
    case 'production':
      return 'https://localhost:3000/callback'; // Should be overridden with actual production URL
    case 'test':
      return 'http://localhost:3001/callback';
    case 'development':
    default:
      return 'http://localhost:3000/callback';
  }
}

/**
 * Validate and merge configuration profile with provided config
 */
export function mergeConfigProfile(
  baseConfig: Partial<AppConfig>,
  env: Environment
): AppConfig {
  const profile = getConfigProfile(env);
  const merged = {
    ...profile,
    ...baseConfig,
    // Deep merge nested objects
    mcpServer: { ...profile.mcpServer, ...baseConfig.mcpServer },
    youtubeAPI: { ...profile.youtubeAPI, ...baseConfig.youtubeAPI },
    storage: { ...profile.storage, ...baseConfig.storage },
    logging: { ...profile.logging, ...baseConfig.logging },
    security: { ...profile.security, ...baseConfig.security },
  };

  // Validate the merged configuration
  try {
    return AppConfigSchema.parse(merged);
  } catch (error) {
    throw new Error(`Invalid configuration for environment '${env}': ${error}`);
  }
}

/**
 * Get recommended settings for specific use cases
 */
export const recommendedSettings = {
  /**
   * High-volume channel settings (1000+ videos)
   */
  highVolume: {
    youtubeAPI: {
      defaultPageSize: 50,
      rateLimitRequestsPerSecond: 50,
      rateLimitRequestsPerMinute: 3000,
    },
    storage: {
      // Organize backups by month for high-volume channels
      backupDir: 'backups/monthly',
    },
  },

  /**
   * Low-volume channel settings (< 100 videos)
   */
  lowVolume: {
    youtubeAPI: {
      defaultPageSize: 10,
      rateLimitRequestsPerSecond: 20,
      rateLimitRequestsPerMinute: 1200,
    },
  },

  /**
   * Security-focused settings
   */
  securityFocused: {
    security: {
      encryptionSecret: 'REQUIRED', // Must be set via environment
    },
    logging: {
      level: 'warn' as LogLevel, // Reduced logging
      enableFile: true,
      maxFiles: 3,
    },
  },

  /**
   * Development with debugging
   */
  debugging: {
    logging: {
      level: 'debug' as LogLevel,
      enableConsole: true,
      enableFile: true,
    },
    youtubeAPI: {
      rateLimitRequestsPerSecond: 10, // Slower for debugging
    },
  },
} as const;