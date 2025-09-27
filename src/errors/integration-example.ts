/**
 * Example integration of the error handling framework with MCP tool handlers
 * This file demonstrates how to integrate the error handling system into existing code
 */

import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  ListVideosSchema,
  ApplyMetadataSchema,
  GenerateMetadataSuggestionsSchema
} from '../types/index.js';

import {
  errorMiddleware,
  validateMCPInput,
  createComprehensiveValidator,
  BusinessRuleValidator,
  ConditionalValidator,
  ErrorFactory,
  ErrorRecoveryOrchestrator,
  OAuthError,
  YouTubeAPIError,
  ValidationError
} from './index.js';

/**
 * Example of how to wrap an existing tool handler with comprehensive error handling
 */
export function createEnhancedToolHandler(
  toolName: string,
  schema: any,
  businessRules?: (input: any) => void
) {
  const validator = createComprehensiveValidator(schema, toolName, businessRules);

  return async (request: any) => {
    try {
      // 1. Validate input with comprehensive validation
      const validatedInput = validator(request.params.arguments, request.params.userId);

      // 2. Execute the main operation with error recovery
      const result = await ErrorRecoveryOrchestrator.handleError(
        new Error('Demo operation'),
        async () => {
          // Your actual operation here
          return await performToolOperation(toolName, validatedInput);
        }
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error) {
      // 3. Handle errors with middleware
      return await errorMiddleware(
        error as Error,
        request,
        async () => performToolOperation(toolName, request.params.arguments)
      );
    }
  };
}

/**
 * Example enhanced list_videos handler
 */
export const enhancedListVideosHandler = createEnhancedToolHandler(
  'list_videos',
  ListVideosSchema,
  (input) => {
    // Additional business rules
    if (input.maxResults && input.maxResults > 50) {
      throw ValidationError.custom(
        'Maximum results cannot exceed 50 for performance reasons',
        'maxResults',
        'value between 1 and 50',
        input.maxResults
      );
    }
  }
);

/**
 * Example enhanced apply_metadata handler with complex validation
 */
export const enhancedApplyMetadataHandler = createEnhancedToolHandler(
  'apply_metadata',
  ApplyMetadataSchema,
  (input) => {
    // Business rule validations
    BusinessRuleValidator.validateVideoId(input.videoId);

    if (input.title || input.description || input.tags) {
      BusinessRuleValidator.validateMetadataLengths({
        title: input.title,
        description: input.description,
        tags: input.tags
      });
    }

    ConditionalValidator.validateGuardrailAcknowledgment({
      suggestionId: input.suggestionId,
      acknowledgedGuardrails: input.acknowledgedGuardrails
    });
  }
);

/**
 * Example of manual error handling integration in existing handler
 */
export async function manuallyEnhancedHandler(request: any) {
  const toolName = 'generate_metadata_suggestions';

  try {
    // 1. Input validation
    const input = validateMCPInput(
      GenerateMetadataSuggestionsSchema,
      request.params.arguments,
      {
        toolName,
        operationType: 'input_validation',
        userId: request.params.userId
      }
    );

    // 2. Business rule validation
    BusinessRuleValidator.validateVideoId(input.videoId);

    // 3. Main operation with error recovery
    const result = await performWithRecovery(async () => {
      // Your existing operation code here
      const { client } = await getYouTubeClient();
      const videos = await client.getVideoDetails(input.videoId);

      if (videos.length === 0) {
        throw ErrorFactory.resourceNotFound('video', input.videoId);
      }

      return videos[0];
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };

  } catch (error) {
    // 4. Error handling with middleware
    return await errorMiddleware(
      error as Error,
      request,
      async () => {
        // Retry operation
        const { client } = await getYouTubeClient();
        return await client.getVideoDetails(input.videoId);
      }
    );
  }
}

/**
 * Helper function for performing operations with automatic error recovery
 */
async function performWithRecovery<T>(operation: () => Promise<T>): Promise<T> {
  return await ErrorRecoveryOrchestrator.handleError(
    new Error('Placeholder'), // This won't be used
    operation
  );
}

/**
 * Mock implementations for example purposes
 */
async function performToolOperation(toolName: string, input: any): Promise<any> {
  // This would contain your actual tool implementation
  console.log(`Performing ${toolName} with input:`, input);
  return { success: true, data: input };
}

async function getYouTubeClient(): Promise<{ client: any }> {
  // This would return your actual YouTube client
  return { client: {} };
}

/**
 * Example of how to integrate error handling into batch operations
 */
export async function enhancedBatchHandler(request: any) {
  const toolName = 'organize_playlists';

  try {
    const input = validateMCPInput(
      // Your batch schema here
      ListVideosSchema, // Placeholder
      request.params.arguments,
      { toolName }
    );

    // Validate batch constraints
    BusinessRuleValidator.validateBatchOperation({
      itemCount: input.videoIds?.length || 0,
      batchType: 'playlist_management'
    });

    // Execute batch with error recovery
    const batchResult = await performBatchOperation(input);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(batchResult, null, 2)
      }]
    };

  } catch (error) {
    return await errorMiddleware(error as Error, request);
  }
}

async function performBatchOperation(input: any): Promise<any> {
  // Mock batch operation
  return { batchId: 'batch_123', status: 'completed' };
}

/**
 * Example of circuit breaker integration for external services
 */
import { CircuitBreaker } from './error-recovery.js';

const youtubeAPICircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
  monitoringWindow: 30000
}, 'youtube-api-calls');

export async function circuitBreakerExample(operation: () => Promise<any>): Promise<any> {
  return await youtubeAPICircuitBreaker.execute(operation);
}

/**
 * Example of quota-aware operation with error handling
 */
export async function quotaAwareOperation(operation: () => Promise<any>, quotaCost: number): Promise<any> {
  try {
    // Check quota before operation
    const currentQuota = await getCurrentQuotaUsage();
    if (currentQuota + quotaCost > getQuotaLimit()) {
      throw ErrorFactory.quotaExceeded(currentQuota + quotaCost, getQuotaLimit());
    }

    // Perform operation with circuit breaker
    return await youtubeAPICircuitBreaker.execute(operation);

  } catch (error) {
    // Handle quota-related errors specially
    if (error instanceof YouTubeAPIError && error.isQuotaRelated()) {
      // Don't retry quota errors
      throw error;
    }

    // Other errors can use standard recovery
    return await ErrorRecoveryOrchestrator.handleError(error as Error, operation);
  }
}

// Mock quota functions
async function getCurrentQuotaUsage(): Promise<number> { return 5000; }
function getQuotaLimit(): number { return 10000; }