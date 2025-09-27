import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { EnvironmentVariablesSchema, type EnvironmentVariables } from './schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');

/**
 * Configuration error class for better error handling
 */
export class ConfigurationError extends Error {
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Environment variable loader with validation and .env file support
 */
export class EnvironmentLoader {
  private loadedEnv: Record<string, string> = {};
  private isLoaded = false;

  /**
   * Load environment variables from .env files and validate them
   */
  public load(): EnvironmentVariables {
    if (!this.isLoaded) {
      this.loadDotEnvFiles();
      this.isLoaded = true;
    }

    const envVars = { ...this.loadedEnv, ...process.env };
    return this.validateEnvironmentVariables(envVars);
  }

  /**
   * Get a specific environment variable with type safety
   */
  public get<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    const env = this.load();
    return env[key];
  }

  /**
   * Check if a specific environment variable is set
   */
  public has(key: keyof EnvironmentVariables): boolean {
    const env = this.load();
    return env[key] !== undefined;
  }

  /**
   * Reload environment variables (useful for testing)
   */
  public reload(): EnvironmentVariables {
    this.isLoaded = false;
    this.loadedEnv = {};
    return this.load();
  }

  /**
   * Load .env files in order of priority
   */
  private loadDotEnvFiles(): void {
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Load files in order of priority (last one wins)
    const envFiles = [
      '.env',                    // Default
      '.env.local',              // Local overrides (gitignored)
      `.env.${nodeEnv}`,         // Environment specific
      `.env.${nodeEnv}.local`,   // Environment specific local (gitignored)
    ];

    for (const envFile of envFiles) {
      try {
        const envPath = resolve(PROJECT_ROOT, envFile);
        const content = readFileSync(envPath, 'utf8');
        const parsed = this.parseDotEnv(content);
        Object.assign(this.loadedEnv, parsed);
      } catch (error) {
        // File doesn't exist or can't be read - that's okay
        // Only .env is required, others are optional
        if (envFile === '.env') {
          // Don't throw for missing .env file - environment variables might be set via other means
        }
      }
    }
  }

  /**
   * Parse .env file content
   */
  private parseDotEnv(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }

      // Parse key=value
      const match = line.match(/^([^=]+)=(.*)$/);
      if (!match) {
        continue;
      }

      const [, key, value] = match;
      const trimmedKey = key.trim();
      let trimmedValue = value.trim();

      // Handle quoted values
      if ((trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
          (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))) {
        trimmedValue = trimmedValue.slice(1, -1);
      }

      // Expand environment variables
      trimmedValue = this.expandVariables(trimmedValue, result);

      result[trimmedKey] = trimmedValue;
    }

    return result;
  }

  /**
   * Expand environment variables in values (e.g., ${VAR_NAME})
   */
  private expandVariables(value: string, context: Record<string, string>): string {
    return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      return context[varName] || process.env[varName] || match;
    });
  }

  /**
   * Validate environment variables against schema
   */
  private validateEnvironmentVariables(envVars: Record<string, any>): EnvironmentVariables {
    try {
      return EnvironmentVariablesSchema.parse(envVars);
    } catch (error: any) {
      const formattedErrors = this.formatValidationErrors(error);
      throw new ConfigurationError(
        `Environment variable validation failed:\n${formattedErrors}`,
        error.errors
      );
    }
  }

  /**
   * Format Zod validation errors into human-readable messages
   */
  private formatValidationErrors(error: any): string {
    if (!error.errors || !Array.isArray(error.errors)) {
      return error.message || 'Unknown validation error';
    }

    return error.errors
      .map((err: any) => {
        const path = err.path.join('.');
        const message = err.message;
        const value = err.received !== undefined ? ` (received: ${err.received})` : '';
        return `  - ${path}: ${message}${value}`;
      })
      .join('\n');
  }
}

/**
 * Global environment loader instance
 */
export const envLoader = new EnvironmentLoader();