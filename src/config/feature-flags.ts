import { z } from 'zod';
import type { Environment } from './schemas.js';

/**
 * Feature flag definition with metadata
 */
export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  defaultValue: boolean;
  environments: {
    development: boolean;
    production: boolean;
    test: boolean;
  };
  dependencies?: string[];
  deprecatedIn?: string;
  removedIn?: string;
}

/**
 * Feature flags configuration schema
 */
export const FeatureFlagsSchema = z.object({
  // Core features
  enableOAuth: z.boolean().default(true).describe('Enable OAuth authentication flow'),
  enableMetadataGeneration: z.boolean().default(true).describe('Enable AI-powered metadata generation'),
  enableVideoScheduling: z.boolean().default(true).describe('Enable video scheduling functionality'),
  enablePlaylistManagement: z.boolean().default(true).describe('Enable playlist creation and management'),
  enableBackupRestore: z.boolean().default(true).describe('Enable metadata backup and restore'),
  enableBatchOperations: z.boolean().default(true).describe('Enable batch processing for operations'),
  enableThumbnailConcepts: z.boolean().default(true).describe('Enable thumbnail concept generation'),

  // Advanced features
  enableTranscriptAnalysis: z.boolean().default(true).describe('Enable transcript fetching and analysis'),
  enableMetadataValidation: z.boolean().default(true).describe('Enable metadata guardrails and validation'),
  enableQuotaMonitoring: z.boolean().default(true).describe('Enable YouTube API quota monitoring'),
  enablePerformanceMetrics: z.boolean().default(false).describe('Enable detailed performance monitoring'),
  enableAuditLogging: z.boolean().default(false).describe('Enable comprehensive audit logging'),

  // Experimental features
  enableAdvancedScheduling: z.boolean().default(false).describe('Enable advanced scheduling algorithms'),
  enableContentAnalysis: z.boolean().default(false).describe('Enable content-based video analysis'),
  enableAutomaticTagging: z.boolean().default(false).describe('Enable automatic tag generation'),
  enableMLOptimization: z.boolean().default(false).describe('Enable machine learning optimizations'),

  // Development/debugging features
  enableDebugMode: z.boolean().default(false).describe('Enable debug mode with verbose logging'),
  enableMockServices: z.boolean().default(false).describe('Enable mock services for testing'),
  enableBetaFeatures: z.boolean().default(false).describe('Enable beta features (unstable)'),
  enableDevTools: z.boolean().default(false).describe('Enable development tools and diagnostics'),

  // API and integration features
  enableWebhooks: z.boolean().default(false).describe('Enable webhook support for external integrations'),
  enableAPIExtensions: z.boolean().default(false).describe('Enable experimental API extensions'),
  enableThirdPartyIntegrations: z.boolean().default(false).describe('Enable third-party service integrations'),

  // Security and compliance features
  enableEncryption: z.boolean().default(true).describe('Enable token encryption at rest'),
  enableRateLimiting: z.boolean().default(true).describe('Enable API rate limiting'),
  enableInputSanitization: z.boolean().default(true).describe('Enable input sanitization and validation'),
  enableComplianceMode: z.boolean().default(false).describe('Enable strict compliance mode'),
});

/**
 * Feature flag definitions with metadata
 */
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  enableOAuth: {
    key: 'enableOAuth',
    name: 'OAuth Authentication',
    description: 'Enables OAuth 2.0 authentication flow for YouTube API access',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: true,
    },
  },

  enableMetadataGeneration: {
    key: 'enableMetadataGeneration',
    name: 'Metadata Generation',
    description: 'Enables AI-powered metadata generation and suggestions',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: true,
    },
    dependencies: ['enableOAuth'],
  },

  enableVideoScheduling: {
    key: 'enableVideoScheduling',
    name: 'Video Scheduling',
    description: 'Enables video scheduling and publish time management',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: true,
    },
    dependencies: ['enableOAuth'],
  },

  enablePlaylistManagement: {
    key: 'enablePlaylistManagement',
    name: 'Playlist Management',
    description: 'Enables playlist creation, organization, and management',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: true,
    },
    dependencies: ['enableOAuth'],
  },

  enableBackupRestore: {
    key: 'enableBackupRestore',
    name: 'Backup & Restore',
    description: 'Enables metadata backup and restore functionality',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: true,
    },
    dependencies: ['enableOAuth'],
  },

  enableBatchOperations: {
    key: 'enableBatchOperations',
    name: 'Batch Operations',
    description: 'Enables batch processing for multiple operations',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: true,
    },
  },

  enableThumbnailConcepts: {
    key: 'enableThumbnailConcepts',
    name: 'Thumbnail Concepts',
    description: 'Enables thumbnail concept generation and suggestions',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: true,
    },
    dependencies: ['enableOAuth'],
  },

  enableTranscriptAnalysis: {
    key: 'enableTranscriptAnalysis',
    name: 'Transcript Analysis',
    description: 'Enables video transcript fetching and analysis',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: false, // Disabled in test to avoid API calls
    },
    dependencies: ['enableOAuth'],
  },

  enableMetadataValidation: {
    key: 'enableMetadataValidation',
    name: 'Metadata Validation',
    description: 'Enables metadata guardrails and validation rules',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: true,
    },
  },

  enableQuotaMonitoring: {
    key: 'enableQuotaMonitoring',
    name: 'Quota Monitoring',
    description: 'Enables YouTube API quota usage monitoring',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: false,
    },
  },

  enablePerformanceMetrics: {
    key: 'enablePerformanceMetrics',
    name: 'Performance Metrics',
    description: 'Enables detailed performance monitoring and metrics collection',
    defaultValue: false,
    environments: {
      development: true,
      production: false, // Disabled in production for performance
      test: false,
    },
  },

  enableAuditLogging: {
    key: 'enableAuditLogging',
    name: 'Audit Logging',
    description: 'Enables comprehensive audit logging for compliance',
    defaultValue: false,
    environments: {
      development: false,
      production: true,
      test: false,
    },
  },

  enableAdvancedScheduling: {
    key: 'enableAdvancedScheduling',
    name: 'Advanced Scheduling',
    description: 'Enables advanced scheduling algorithms and optimization',
    defaultValue: false,
    environments: {
      development: true,
      production: false, // Experimental
      test: true,
    },
    dependencies: ['enableVideoScheduling'],
  },

  enableContentAnalysis: {
    key: 'enableContentAnalysis',
    name: 'Content Analysis',
    description: 'Enables content-based video analysis and categorization',
    defaultValue: false,
    environments: {
      development: true,
      production: false, // Experimental
      test: true,
    },
    dependencies: ['enableTranscriptAnalysis'],
  },

  enableAutomaticTagging: {
    key: 'enableAutomaticTagging',
    name: 'Automatic Tagging',
    description: 'Enables automatic tag generation based on content analysis',
    defaultValue: false,
    environments: {
      development: true,
      production: false, // Experimental
      test: true,
    },
    dependencies: ['enableContentAnalysis', 'enableMetadataGeneration'],
  },

  enableMLOptimization: {
    key: 'enableMLOptimization',
    name: 'ML Optimization',
    description: 'Enables machine learning optimizations for recommendations',
    defaultValue: false,
    environments: {
      development: false,
      production: false, // Experimental
      test: false,
    },
    dependencies: ['enableContentAnalysis', 'enablePerformanceMetrics'],
  },

  enableDebugMode: {
    key: 'enableDebugMode',
    name: 'Debug Mode',
    description: 'Enables debug mode with verbose logging and diagnostics',
    defaultValue: false,
    environments: {
      development: true,
      production: false,
      test: true,
    },
  },

  enableMockServices: {
    key: 'enableMockServices',
    name: 'Mock Services',
    description: 'Enables mock services for testing without API calls',
    defaultValue: false,
    environments: {
      development: false,
      production: false,
      test: true,
    },
  },

  enableBetaFeatures: {
    key: 'enableBetaFeatures',
    name: 'Beta Features',
    description: 'Enables beta features that may be unstable',
    defaultValue: false,
    environments: {
      development: true,
      production: false,
      test: true,
    },
  },

  enableDevTools: {
    key: 'enableDevTools',
    name: 'Development Tools',
    description: 'Enables development tools and diagnostics',
    defaultValue: false,
    environments: {
      development: true,
      production: false,
      test: false,
    },
  },

  enableWebhooks: {
    key: 'enableWebhooks',
    name: 'Webhooks',
    description: 'Enables webhook support for external integrations',
    defaultValue: false,
    environments: {
      development: false,
      production: false, // Future feature
      test: false,
    },
  },

  enableAPIExtensions: {
    key: 'enableAPIExtensions',
    name: 'API Extensions',
    description: 'Enables experimental API extensions and endpoints',
    defaultValue: false,
    environments: {
      development: true,
      production: false,
      test: true,
    },
  },

  enableThirdPartyIntegrations: {
    key: 'enableThirdPartyIntegrations',
    name: 'Third-party Integrations',
    description: 'Enables integrations with third-party services',
    defaultValue: false,
    environments: {
      development: false,
      production: false, // Future feature
      test: false,
    },
  },

  enableEncryption: {
    key: 'enableEncryption',
    name: 'Token Encryption',
    description: 'Enables encryption of OAuth tokens at rest',
    defaultValue: true,
    environments: {
      development: false, // Optional in dev
      production: true,
      test: false,
    },
  },

  enableRateLimiting: {
    key: 'enableRateLimiting',
    name: 'Rate Limiting',
    description: 'Enables API rate limiting and quota management',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: false, // Disabled for faster tests
    },
  },

  enableInputSanitization: {
    key: 'enableInputSanitization',
    name: 'Input Sanitization',
    description: 'Enables input sanitization and validation',
    defaultValue: true,
    environments: {
      development: true,
      production: true,
      test: true,
    },
  },

  enableComplianceMode: {
    key: 'enableComplianceMode',
    name: 'Compliance Mode',
    description: 'Enables strict compliance mode with enhanced security',
    defaultValue: false,
    environments: {
      development: false,
      production: true,
      test: false,
    },
    dependencies: ['enableEncryption', 'enableAuditLogging', 'enableInputSanitization'],
  },
};

/**
 * Feature flags manager for runtime flag checking
 */
export class FeatureFlagsManager {
  private flags: Record<string, boolean> = {};
  private environment: Environment;

  constructor(environment: Environment, overrides: Record<string, boolean> = {}) {
    this.environment = environment;
    this.initializeFlags(overrides);
  }

  /**
   * Initialize feature flags based on environment and overrides
   */
  private initializeFlags(overrides: Record<string, boolean>): void {
    for (const [key, flagDef] of Object.entries(FEATURE_FLAGS)) {
      // Start with environment-specific default
      let value = flagDef.environments[this.environment];

      // Apply override if provided
      if (key in overrides) {
        value = overrides[key];
      }

      this.flags[key] = value;
    }

    // Validate dependencies
    this.validateDependencies();
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flag: string): boolean {
    return this.flags[flag] ?? false;
  }

  /**
   * Get all enabled flags
   */
  getEnabledFlags(): string[] {
    return Object.entries(this.flags)
      .filter(([, enabled]) => enabled)
      .map(([flag]) => flag);
  }

  /**
   * Get all disabled flags
   */
  getDisabledFlags(): string[] {
    return Object.entries(this.flags)
      .filter(([, enabled]) => !enabled)
      .map(([flag]) => flag);
  }

  /**
   * Get flag status with metadata
   */
  getFlagStatus(flag: string): { enabled: boolean; definition: FeatureFlag } | null {
    const definition = FEATURE_FLAGS[flag];
    if (!definition) return null;

    return {
      enabled: this.isEnabled(flag),
      definition,
    };
  }

  /**
   * Get all flags with their status
   */
  getAllFlags(): Record<string, { enabled: boolean; definition: FeatureFlag }> {
    const result: Record<string, { enabled: boolean; definition: FeatureFlag }> = {};

    for (const flag of Object.keys(FEATURE_FLAGS)) {
      const status = this.getFlagStatus(flag);
      if (status) {
        result[flag] = status;
      }
    }

    return result;
  }

  /**
   * Set a feature flag at runtime (for testing)
   */
  setFlag(flag: string, enabled: boolean): void {
    if (!(flag in FEATURE_FLAGS)) {
      throw new Error(`Unknown feature flag: ${flag}`);
    }

    this.flags[flag] = enabled;
    this.validateDependencies();
  }

  /**
   * Validate feature flag dependencies
   */
  private validateDependencies(): void {
    for (const [flag, definition] of Object.entries(FEATURE_FLAGS)) {
      if (this.flags[flag] && definition.dependencies) {
        for (const dependency of definition.dependencies) {
          if (!this.flags[dependency]) {
            // Auto-enable dependency or warn
            this.flags[dependency] = true;
          }
        }
      }
    }
  }

  /**
   * Get flags that are deprecated or scheduled for removal
   */
  getDeprecatedFlags(): { flag: string; deprecatedIn?: string; removedIn?: string }[] {
    return Object.entries(FEATURE_FLAGS)
      .filter(([, def]) => def.deprecatedIn || def.removedIn)
      .map(([flag, def]) => ({
        flag,
        deprecatedIn: def.deprecatedIn,
        removedIn: def.removedIn,
      }));
  }

  /**
   * Get feature flags summary for the current environment
   */
  getSummary(): {
    environment: Environment;
    totalFlags: number;
    enabledCount: number;
    disabledCount: number;
    experimentalCount: number;
    deprecatedCount: number;
  } {
    const total = Object.keys(FEATURE_FLAGS).length;
    const enabled = this.getEnabledFlags().length;
    const experimental = Object.values(FEATURE_FLAGS)
      .filter(def => def.environments.production === false && def.environments.development === true)
      .length;
    const deprecated = this.getDeprecatedFlags().length;

    return {
      environment: this.environment,
      totalFlags: total,
      enabledCount: enabled,
      disabledCount: total - enabled,
      experimentalCount: experimental,
      deprecatedCount: deprecated,
    };
  }
}

/**
 * Parse feature flags from environment variables
 */
export function parseFeatureFlagsFromEnv(env: Record<string, string | undefined>): Record<string, boolean> {
  const flags: Record<string, boolean> = {};

  for (const key of Object.keys(FEATURE_FLAGS)) {
    const envKey = `FEATURE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    const envValue = env[envKey];

    if (envValue !== undefined) {
      flags[key] = envValue.toLowerCase() === 'true';
    }
  }

  return flags;
}

// Export types
export type FeatureFlagsConfig = z.infer<typeof FeatureFlagsSchema>;