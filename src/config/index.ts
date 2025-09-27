import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  AppConfigSchema,
  type AppConfig,
  type Environment,
  type EnvironmentVariables,
} from './schemas.js';
import { envLoader, ConfigurationError } from './env-loader.js';
import { getConfigProfile, getDefaultOAuthScopes, getDefaultRedirectUri, mergeConfigProfile } from './profiles.js';
import { ConfigValidator, formatValidationResults } from './validator.js';
import { FeatureFlagsManager, parseFeatureFlagsFromEnv } from './feature-flags.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');

/**
 * Main configuration manager for the YouTube MCP Extended application
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig | null = null;
  private env: EnvironmentVariables | null = null;
  private featureFlags: FeatureFlagsManager | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load and validate configuration
   */
  load(): AppConfig {
    if (this.config) {
      return this.config;
    }

    try {
      // Load environment variables
      this.env = envLoader.load();

      // Validate environment variables
      const envValidation = ConfigValidator.validateEnvironmentVariables(this.env);
      if (!envValidation.isValid) {
        throw new ConfigurationError(
          'Environment variable validation failed:\n' + formatValidationResults(envValidation),
          envValidation.errors
        );
      }

      // Build configuration from environment variables
      const config = this.buildConfigFromEnv(this.env);

      // Validate complete configuration
      const configValidation = ConfigValidator.validateAppConfig(config);
      if (!configValidation.isValid) {
        throw new ConfigurationError(
          'Configuration validation failed:\n' + formatValidationResults(configValidation),
          configValidation.errors
        );
      }

      // Check for common issues
      const issuesValidation = ConfigValidator.checkCommonIssues(config);
      if (!issuesValidation.isValid) {
        throw new ConfigurationError(
          'Configuration has critical issues:\n' + formatValidationResults(issuesValidation),
          issuesValidation.errors
        );
      }

      // Store validated configuration
      this.config = config;

      // Log warnings and suggestions if any
      if (issuesValidation.warnings.length > 0 || issuesValidation.suggestions.length > 0) {
        const feedback = formatValidationResults(issuesValidation);
        // Note: In production MCP servers, we should not log to console
        // This would be handled by the application's logging system
      }

      return this.config;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(
        `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Get current configuration (load if not already loaded)
   */
  getConfig(): AppConfig {
    return this.load();
  }

  /**
   * Get environment variables
   */
  getEnv(): EnvironmentVariables {
    if (!this.env) {
      this.env = envLoader.load();
    }
    return this.env;
  }

  /**
   * Reload configuration (useful for testing or config changes)
   */
  reload(): AppConfig {
    this.config = null;
    this.env = null;
    this.featureFlags = null;
    envLoader.reload();
    return this.load();
  }

  /**
   * Get specific configuration section
   */
  getOAuthConfig() {
    return this.getConfig().oauth;
  }

  getSecurityConfig() {
    return this.getConfig().security;
  }

  getMCPServerConfig() {
    return this.getConfig().mcpServer;
  }

  getYouTubeAPIConfig() {
    return this.getConfig().youtubeAPI;
  }

  getStorageConfig() {
    return this.getConfig().storage;
  }

  getLoggingConfig() {
    return this.getConfig().logging;
  }

  getFeatureFlagsConfig() {
    return this.getConfig().features;
  }

  getFeatureFlags(): FeatureFlagsManager {
    if (!this.featureFlags) {
      const config = this.getConfig();
      this.featureFlags = new FeatureFlagsManager(config.env, config.features);
    }
    return this.featureFlags;
  }

  /**
   * Get resolved paths for storage directories
   */
  getStoragePaths() {
    const storage = this.getStorageConfig();
    return {
      backupDir: resolve(PROJECT_ROOT, storage.backupDir),
      metadataSuggestionsDir: resolve(PROJECT_ROOT, storage.metadataSuggestionsDir),
      tempDir: resolve(PROJECT_ROOT, storage.tempDir),
      tokenDir: resolve(PROJECT_ROOT, this.getSecurityConfig().tokenStorageDir || 'tokens'),
    };
  }

  /**
   * Check if running in specific environment
   */
  isDevelopment(): boolean {
    return this.getConfig().env === 'development';
  }

  isProduction(): boolean {
    return this.getConfig().env === 'production';
  }

  isTest(): boolean {
    return this.getConfig().env === 'test';
  }

  /**
   * Build configuration from environment variables
   */
  private buildConfigFromEnv(env: EnvironmentVariables): AppConfig {
    const nodeEnv = (env.NODE_ENV || 'development') as Environment;

    // Get OAuth configuration with backward compatibility
    const clientId = env.YOUTUBE_CLIENT_ID || env.GOOGLE_CLIENT_ID;
    const clientSecret = env.YOUTUBE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET;
    const redirectUri = env.YOUTUBE_REDIRECT_URI || env.GOOGLE_REDIRECT_URI || getDefaultRedirectUri(nodeEnv);
    const scopesString = env.YOUTUBE_OAUTH_SCOPES || env.GOOGLE_OAUTH_SCOPES;
    const scopes = scopesString
      ? scopesString.split(',').map(s => s.trim()).filter(Boolean)
      : getDefaultOAuthScopes(nodeEnv);

    if (!clientId || !clientSecret) {
      throw new ConfigurationError(
        'OAuth credentials are required. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables.',
        { missing: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'] }
      );
    }

    // Parse feature flags from environment (convert to string record)
    const envRecord: Record<string, string | undefined> = Object.fromEntries(
      Object.entries(env).map(([key, value]) => [key, typeof value === 'string' ? value : value?.toString()])
    );
    const featureFlagOverrides = parseFeatureFlagsFromEnv(envRecord);

    // Build base configuration
    const baseConfig: Partial<AppConfig> = {
      env: nodeEnv,
      oauth: {
        clientId,
        clientSecret,
        redirectUri,
        scopes,
      },
      security: {
        encryptionSecret: env.OAUTH_ENCRYPTION_SECRET,
        tokenStorageDir: env.OAUTH_STORAGE_DIR,
      },
      logging: {
        level: env.LOG_LEVEL || 'info',
        enableFile: env.ENABLE_FILE_LOGGING || false,
        logDir: env.LOG_DIR || 'logs',
        enableConsole: nodeEnv !== 'production', // Disable console logging in production for MCP
        maxFileSize: '10MB',
        maxFiles: 5,
      },
      youtubeAPI: {
        quotaLimit: env.YOUTUBE_QUOTA_LIMIT || 10000,
        rateLimitRequestsPerSecond: env.YOUTUBE_RATE_LIMIT_RPS || 100,
        rateLimitRequestsPerMinute: env.YOUTUBE_RATE_LIMIT_RPM || 6000,
        defaultPageSize: 25,
      },
      storage: {
        backupDir: env.BACKUP_DIR || 'backups',
        metadataSuggestionsDir: env.METADATA_SUGGESTIONS_DIR || 'storage/metadata-suggestions',
        tempDir: env.TEMP_DIR || 'temp',
      },
      mcpServer: {
        name: env.MCP_SERVER_NAME || 'youtube-mcp-extended',
        version: env.MCP_SERVER_VERSION || '1.0.0',
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: true, subscribe: true },
          prompts: { listChanged: false },
        },
      },
      features: featureFlagOverrides,
    };

    // Merge with environment profile
    return mergeConfigProfile(baseConfig, nodeEnv);
  }
}

// Export singleton instance and convenience functions
export const configManager = ConfigManager.getInstance();

/**
 * Convenience function to get configuration
 */
export function getConfig(): AppConfig {
  return configManager.getConfig();
}

/**
 * Convenience function to get OAuth configuration
 */
export function getOAuthConfig() {
  return configManager.getOAuthConfig();
}

/**
 * Convenience function to get security configuration
 */
export function getSecurityConfig() {
  return configManager.getSecurityConfig();
}

/**
 * Convenience function to get MCP server configuration
 */
export function getMCPServerConfig() {
  return configManager.getMCPServerConfig();
}

/**
 * Convenience function to get YouTube API configuration
 */
export function getYouTubeAPIConfig() {
  return configManager.getYouTubeAPIConfig();
}

/**
 * Convenience function to get storage configuration
 */
export function getStorageConfig() {
  return configManager.getStorageConfig();
}

/**
 * Convenience function to get logging configuration
 */
export function getLoggingConfig() {
  return configManager.getLoggingConfig();
}

/**
 * Convenience function to get storage paths
 */
export function getStoragePaths() {
  return configManager.getStoragePaths();
}

/**
 * Convenience function to get feature flags configuration
 */
export function getFeatureFlagsConfig() {
  return configManager.getFeatureFlagsConfig();
}

/**
 * Convenience function to get feature flags manager
 */
export function getFeatureFlags(): FeatureFlagsManager {
  return configManager.getFeatureFlags();
}

/**
 * Environment check functions
 */
export function isDevelopment(): boolean {
  return configManager.isDevelopment();
}

export function isProduction(): boolean {
  return configManager.isProduction();
}

export function isTest(): boolean {
  return configManager.isTest();
}

// Re-export types and utilities
export * from './schemas.js';
export * from './env-loader.js';
export * from './profiles.js';
export * from './validator.js';
export * from './mcp-helpers.js';