import { ZodError } from 'zod';
import type { AppConfig, EnvironmentVariables } from './schemas.js';
import { AppConfigSchema, EnvironmentVariablesSchema } from './schemas.js';

/**
 * Configuration validation error with detailed information
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: any,
    public readonly suggestions: string[] = []
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Configuration validation results
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Configuration validator with detailed error messages and suggestions
 */
export class ConfigValidator {
  /**
   * Validate complete application configuration
   */
  static validateAppConfig(config: unknown): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      AppConfigSchema.parse(config);
    } catch (error) {
      result.isValid = false;
      if (error instanceof ZodError) {
        result.errors = this.formatZodErrors(error, 'AppConfig');
      } else {
        result.errors = [
          new ValidationError(
            'Unknown validation error',
            'unknown',
            config,
            ['Check the configuration format and try again']
          ),
        ];
      }
    }

    // Add warnings and suggestions
    if (result.isValid && config && typeof config === 'object') {
      const warnings = this.generateWarnings(config as AppConfig);
      result.warnings = warnings;

      const suggestions = this.generateSuggestions(config as AppConfig);
      result.suggestions = suggestions;
    }

    return result;
  }

  /**
   * Validate environment variables
   */
  static validateEnvironmentVariables(env: unknown): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      EnvironmentVariablesSchema.parse(env);
    } catch (error) {
      result.isValid = false;
      if (error instanceof ZodError) {
        result.errors = this.formatZodErrors(error, 'EnvironmentVariables');
      } else {
        result.errors = [
          new ValidationError(
            'Unknown validation error in environment variables',
            'unknown',
            env,
            ['Check your .env file format and environment variable names']
          ),
        ];
      }
    }

    // Add environment-specific warnings and suggestions
    if (result.isValid && env && typeof env === 'object') {
      const envWarnings = this.generateEnvironmentWarnings(env as EnvironmentVariables);
      result.warnings = envWarnings;

      const envSuggestions = this.generateEnvironmentSuggestions(env as EnvironmentVariables);
      result.suggestions = envSuggestions;
    }

    return result;
  }

  /**
   * Check for common configuration issues
   */
  static checkCommonIssues(config: AppConfig): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Check OAuth configuration
    if (!config.oauth.clientId || !config.oauth.clientSecret) {
      result.errors.push(
        new ValidationError(
          'OAuth credentials are missing',
          'oauth',
          config.oauth,
          [
            'Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables',
            'Obtain credentials from Google Cloud Console',
            'Enable YouTube Data API v3 in your Google Cloud project',
          ]
        )
      );
      result.isValid = false;
    }

    // Check redirect URI format
    try {
      new URL(config.oauth.redirectUri);
    } catch {
      result.errors.push(
        new ValidationError(
          'Invalid OAuth redirect URI format',
          'oauth.redirectUri',
          config.oauth.redirectUri,
          [
            'Use a valid URL format (e.g., http://localhost:3000/callback)',
            'Ensure the URI matches the one configured in Google Cloud Console',
          ]
        )
      );
      result.isValid = false;
    }

    // Check OAuth scopes
    if (config.oauth.scopes.length === 0) {
      result.errors.push(
        new ValidationError(
          'No OAuth scopes configured',
          'oauth.scopes',
          config.oauth.scopes,
          [
            'Add at least https://www.googleapis.com/auth/youtube scope',
            'Include https://www.googleapis.com/auth/youtube.upload for video management',
          ]
        )
      );
      result.isValid = false;
    }

    // Check for invalid scopes
    const validScopePatterns = [
      /^https:\/\/www\.googleapis\.com\/auth\/youtube/,
      /^https:\/\/www\.googleapis\.com\/auth\/youtubepartner/,
    ];

    for (const scope of config.oauth.scopes) {
      if (!validScopePatterns.some(pattern => pattern.test(scope))) {
        result.warnings.push(
          `Potentially invalid OAuth scope: ${scope}. Ensure it's a valid YouTube API scope.`
        );
      }
    }

    // Check API quota limits
    if (config.youtubeAPI.quotaLimit < 1000) {
      result.warnings.push(
        'YouTube API quota limit is very low. Consider increasing it if you encounter quota errors.'
      );
    }

    // Check storage directories
    if (config.storage.backupDir === config.storage.tempDir) {
      result.warnings.push(
        'Backup and temporary directories are the same. Consider using separate directories.'
      );
    }

    // Check production-specific issues
    if (config.env === 'production') {
      if (config.logging.enableConsole) {
        result.warnings.push(
          'Console logging is enabled in production. This may interfere with MCP communication.'
        );
      }

      if (!config.security.encryptionSecret) {
        result.warnings.push(
          'No encryption secret configured for production. OAuth tokens will be stored unencrypted.'
        );
      }

      if (config.oauth.redirectUri.includes('localhost')) {
        result.errors.push(
          new ValidationError(
            'Localhost redirect URI in production',
            'oauth.redirectUri',
            config.oauth.redirectUri,
            [
              'Use a production-ready redirect URI',
              'Update your Google Cloud Console OAuth configuration',
            ]
          )
        );
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Format Zod validation errors into ValidationError objects
   */
  private static formatZodErrors(error: ZodError, context: string): ValidationError[] {
    return error.errors.map(err => {
      const field = err.path.join('.');
      const value = (err as any).received;

      let message = err.message;
      let suggestions: string[] = [];

      // Provide specific suggestions based on error type
      switch (err.code) {
        case 'invalid_type':
          if (err.expected === 'string' && typeof value === 'undefined') {
            suggestions = [`Set the ${field} environment variable`];
          } else {
            suggestions = [`Expected ${err.expected}, got ${typeof value}`];
          }
          break;

        case 'too_small':
          if (err.type === 'string') {
            suggestions = [`${field} must be at least ${err.minimum} characters long`];
          } else if (err.type === 'array') {
            suggestions = [`${field} must have at least ${err.minimum} items`];
          }
          break;

        case 'invalid_string':
          if (err.validation === 'url') {
            suggestions = [
              'Use a valid URL format (e.g., https://example.com)',
              'Include protocol (http:// or https://)',
            ];
          } else if (err.validation === 'email') {
            suggestions = ['Use a valid email format (e.g., user@example.com)'];
          }
          break;

        case 'invalid_enum_value':
          suggestions = [
            `Valid options are: ${(err as any).options?.join(', ') || 'see documentation'}`,
            `You provided: ${value}`,
          ];
          break;

        default:
          suggestions = ['Check the configuration documentation for valid values'];
      }

      return new ValidationError(
        `${context}.${field}: ${message}`,
        field,
        value,
        suggestions
      );
    });
  }

  /**
   * Generate warnings for potentially problematic configurations
   */
  private static generateWarnings(config: AppConfig): string[] {
    const warnings: string[] = [];

    // Rate limiting warnings
    const rps = config.youtubeAPI.rateLimitRequestsPerSecond;
    const rpm = config.youtubeAPI.rateLimitRequestsPerMinute;

    if (rps * 60 > rpm) {
      warnings.push(
        `Rate limit mismatch: ${rps} requests/second would exceed ${rpm} requests/minute limit`
      );
    }

    // Logging warnings
    if (config.env === 'production' && config.logging.level === 'debug') {
      warnings.push(
        'Debug logging enabled in production may impact performance'
      );
    }

    // Storage warnings
    if (config.storage.backupDir.includes('temp')) {
      warnings.push(
        'Backup directory appears to be temporary - backups may be deleted unexpectedly'
      );
    }

    return warnings;
  }

  /**
   * Generate suggestions for improving configuration
   */
  private static generateSuggestions(config: AppConfig): string[] {
    const suggestions: string[] = [];

    // Performance suggestions
    if (config.youtubeAPI.defaultPageSize < 10) {
      suggestions.push(
        'Consider increasing defaultPageSize for better performance with large video lists'
      );
    }

    // Security suggestions
    if (config.env !== 'test' && !config.security.encryptionSecret) {
      suggestions.push(
        'Set OAUTH_ENCRYPTION_SECRET for enhanced security of stored tokens'
      );
    }

    // Environment-specific suggestions
    if (config.env === 'development') {
      suggestions.push(
        'Consider enabling file logging for development debugging'
      );
    }

    return suggestions;
  }

  /**
   * Generate environment variable specific warnings
   */
  private static generateEnvironmentWarnings(env: EnvironmentVariables): string[] {
    const warnings: string[] = [];

    // Check for deprecated variable names
    if (env.GOOGLE_CLIENT_ID && env.YOUTUBE_CLIENT_ID) {
      warnings.push(
        'Both GOOGLE_CLIENT_ID and YOUTUBE_CLIENT_ID are set. YOUTUBE_CLIENT_ID will take precedence.'
      );
    }

    if (env.GOOGLE_CLIENT_SECRET && env.YOUTUBE_CLIENT_SECRET) {
      warnings.push(
        'Both GOOGLE_CLIENT_SECRET and YOUTUBE_CLIENT_SECRET are set. YOUTUBE_CLIENT_SECRET will take precedence.'
      );
    }

    // Check for missing optional but recommended variables
    if (!env.OAUTH_ENCRYPTION_SECRET && env.NODE_ENV === 'production') {
      warnings.push(
        'OAUTH_ENCRYPTION_SECRET not set in production. Tokens will be stored unencrypted.'
      );
    }

    return warnings;
  }

  /**
   * Generate environment variable specific suggestions
   */
  private static generateEnvironmentSuggestions(env: EnvironmentVariables): string[] {
    const suggestions: string[] = [];

    // OAuth setup suggestions
    if (!env.YOUTUBE_CLIENT_ID && !env.GOOGLE_CLIENT_ID) {
      suggestions.push(
        'Set up YouTube OAuth credentials in Google Cloud Console and add YOUTUBE_CLIENT_ID'
      );
    }

    // Development suggestions
    if (env.NODE_ENV === 'development' && !env.LOG_LEVEL) {
      suggestions.push(
        'Set LOG_LEVEL=debug for detailed development logging'
      );
    }

    // Production suggestions
    if (env.NODE_ENV === 'production') {
      if (!env.OAUTH_STORAGE_DIR) {
        suggestions.push(
          'Set OAUTH_STORAGE_DIR to a secure location for production token storage'
        );
      }
    }

    return suggestions;
  }
}

/**
 * Format validation results for display
 */
export function formatValidationResults(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.isValid) {
    lines.push('✅ Configuration is valid');
  } else {
    lines.push('❌ Configuration validation failed');
  }

  if (result.errors.length > 0) {
    lines.push('\n🔴 Errors:');
    for (const error of result.errors) {
      lines.push(`  • ${error.message}`);
      if (error.suggestions.length > 0) {
        lines.push('    Suggestions:');
        for (const suggestion of error.suggestions) {
          lines.push(`    - ${suggestion}`);
        }
      }
    }
  }

  if (result.warnings.length > 0) {
    lines.push('\n🟡 Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  • ${warning}`);
    }
  }

  if (result.suggestions.length > 0) {
    lines.push('\n💡 Suggestions:');
    for (const suggestion of result.suggestions) {
      lines.push(`  • ${suggestion}`);
    }
  }

  return lines.join('\n');
}