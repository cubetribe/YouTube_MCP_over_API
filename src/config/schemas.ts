import { z } from 'zod';
import { FeatureFlagsSchema } from './feature-flags.js';

/**
 * Base environment schema with common validation patterns
 */
export const EnvironmentSchema = z.enum(['development', 'production', 'test'], {
  description: 'Application environment',
});

/**
 * Log level schema for structured logging configuration
 */
export const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug'], {
  description: 'Logging level',
});

/**
 * OAuth configuration schema with validation for Google OAuth 2.0
 */
export const OAuthConfigSchema = z.object({
  clientId: z.string().min(1, 'OAuth client ID is required').describe('Google OAuth 2.0 client ID'),
  clientSecret: z.string().min(1, 'OAuth client secret is required').describe('Google OAuth 2.0 client secret'),
  redirectUri: z.string().url('Invalid redirect URI format').describe('OAuth redirect URI'),
  scopes: z.array(z.string().url('Invalid OAuth scope format')).min(1, 'At least one OAuth scope is required').describe('OAuth scopes'),
});

/**
 * Security configuration schema for encryption and token management
 */
export const SecurityConfigSchema = z.object({
  encryptionSecret: z.string().optional().describe('Secret for token encryption (optional)'),
  tokenStorageDir: z.string().optional().describe('Directory for storing OAuth tokens'),
});

/**
 * MCP server configuration schema
 */
export const MCPServerConfigSchema = z.object({
  name: z.string().default('youtube-mcp-extended').describe('MCP server name'),
  version: z.string().default('1.0.0').describe('MCP server version'),
  capabilities: z.object({
    tools: z.object({
      listChanged: z.boolean().default(true),
    }).default({}),
    resources: z.object({
      listChanged: z.boolean().default(true),
      subscribe: z.boolean().default(true),
    }).default({}),
    prompts: z.object({
      listChanged: z.boolean().default(false),
    }).default({}),
  }).default({}),
});

/**
 * YouTube API configuration schema
 */
export const YouTubeAPIConfigSchema = z.object({
  quotaLimit: z.number().positive().default(10000).describe('Daily quota limit for YouTube API'),
  rateLimitRequestsPerSecond: z.number().positive().default(100).describe('Rate limit for API requests per second'),
  rateLimitRequestsPerMinute: z.number().positive().default(6000).describe('Rate limit for API requests per minute'),
  defaultPageSize: z.number().positive().max(50).default(25).describe('Default page size for API requests'),
});

/**
 * Storage configuration schema
 */
export const StorageConfigSchema = z.object({
  backupDir: z.string().default('backups').describe('Directory for storing backups'),
  metadataSuggestionsDir: z.string().default('storage/metadata-suggestions').describe('Directory for metadata suggestions'),
  tempDir: z.string().default('temp').describe('Temporary files directory'),
});

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  level: LogLevelSchema.default('info'),
  enableConsole: z.boolean().default(true).describe('Enable console logging'),
  enableFile: z.boolean().default(false).describe('Enable file logging'),
  logDir: z.string().default('logs').describe('Directory for log files'),
  maxFileSize: z.string().default('10MB').describe('Maximum log file size'),
  maxFiles: z.number().positive().default(5).describe('Maximum number of log files to keep'),
});

/**
 * Complete application configuration schema
 */
export const AppConfigSchema = z.object({
  env: EnvironmentSchema.default('development'),
  oauth: OAuthConfigSchema,
  security: SecurityConfigSchema.default({}),
  mcpServer: MCPServerConfigSchema.default({}),
  youtubeAPI: YouTubeAPIConfigSchema.default({}),
  storage: StorageConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
  features: FeatureFlagsSchema.default({}),
});

/**
 * Environment variables schema for validation
 */
export const EnvironmentVariablesSchema = z.object({
  // Environment
  NODE_ENV: EnvironmentSchema.optional(),

  // OAuth Configuration (supporting both YOUTUBE_ and GOOGLE_ prefixes for backward compatibility)
  YOUTUBE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REDIRECT_URI: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  YOUTUBE_OAUTH_SCOPES: z.string().optional(),
  GOOGLE_OAUTH_SCOPES: z.string().optional(),

  // Security
  OAUTH_ENCRYPTION_SECRET: z.string().optional(),
  OAUTH_STORAGE_DIR: z.string().optional(),

  // Logging
  LOG_LEVEL: LogLevelSchema.optional(),
  LOG_DIR: z.string().optional(),
  ENABLE_FILE_LOGGING: z.string().optional().transform(val => val === 'true'),

  // API Configuration
  YOUTUBE_QUOTA_LIMIT: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  YOUTUBE_RATE_LIMIT_RPS: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  YOUTUBE_RATE_LIMIT_RPM: z.string().optional().transform(val => val ? parseInt(val) : undefined),

  // Storage
  BACKUP_DIR: z.string().optional(),
  METADATA_SUGGESTIONS_DIR: z.string().optional(),
  TEMP_DIR: z.string().optional(),

  // MCP Server
  MCP_SERVER_NAME: z.string().optional(),
  MCP_SERVER_VERSION: z.string().optional(),
});

// Export type definitions
export type Environment = z.infer<typeof EnvironmentSchema>;
export type LogLevel = z.infer<typeof LogLevelSchema>;
export type OAuthConfig = z.infer<typeof OAuthConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;
export type YouTubeAPIConfig = z.infer<typeof YouTubeAPIConfigSchema>;
export type StorageConfig = z.infer<typeof StorageConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type EnvironmentVariables = z.infer<typeof EnvironmentVariablesSchema>;

// Re-export feature flags types
export type { FeatureFlagsConfig } from './feature-flags.js';