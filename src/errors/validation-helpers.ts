/**
 * Input validation helpers and enhanced Zod schema validation
 */

import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from './validation-error.js';
import { logger } from '../lib/logger.js';
import type { MCPToolInput } from '../types/index.js';

/**
 * Enhanced validation function that creates detailed ValidationError instances
 */
export function validateMCPInput<T>(
  schema: ZodSchema<T>,
  input: unknown,
  context: {
    toolName?: string;
    operationType?: string;
    userId?: string;
  } = {}
): T {
  try {
    const result = schema.parse(input);

    // Log successful validation for audit trail
    logger.debug(
      `Input validation successful for ${context.toolName || 'unknown tool'}`,
      'api',
      {
        toolName: context.toolName,
        operationType: context.operationType,
        userId: context.userId,
        inputKeys: typeof input === 'object' && input !== null
          ? Object.keys(input as Record<string, unknown>)
          : undefined
      }
    );

    return result;
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = ValidationError.fromZodError(error, {
        operation: `validate_${context.toolName}`,
        userId: context.userId,
        metadata: {
          toolName: context.toolName,
          operationType: context.operationType,
          inputType: typeof input
        }
      });

      // Log validation failure
      logger.warn(
        `Input validation failed for ${context.toolName || 'unknown tool'}`,
        'api',
        {
          toolName: context.toolName,
          operationType: context.operationType,
          userId: context.userId,
          errorCount: validationError.issues.length,
          errors: validationError.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        }
      );

      throw validationError;
    }

    throw error;
  }
}

/**
 * Create a validator function for a specific tool
 */
export function createInputValidator<T>(
  schema: ZodSchema<T>,
  toolName: string
) {
  return (input: unknown, userId?: string): T => {
    return validateMCPInput(schema, input, {
      toolName,
      operationType: 'input_validation',
      userId
    });
  };
}

/**
 * Business rule validation helpers
 */
export class BusinessRuleValidator {
  /**
   * Validate video ID format and accessibility
   */
  static validateVideoId(videoId: string): void {
    // YouTube video IDs are 11 characters long
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      throw ValidationError.custom(
        'Invalid YouTube video ID format',
        'videoId',
        '11-character alphanumeric string',
        videoId
      );
    }
  }

  /**
   * Validate playlist ID format
   */
  static validatePlaylistId(playlistId: string): void {
    // YouTube playlist IDs start with 'PL' and are 34 characters total
    if (!/^PL[a-zA-Z0-9_-]{32}$/.test(playlistId)) {
      throw ValidationError.custom(
        'Invalid YouTube playlist ID format',
        'playlistId',
        'ID starting with "PL" followed by 32 characters',
        playlistId
      );
    }
  }

  /**
   * Validate metadata lengths according to YouTube limits
   */
  static validateMetadataLengths(metadata: {
    title?: string;
    description?: string;
    tags?: string[];
  }): void {
    if (metadata.title && metadata.title.length > 100) {
      throw ValidationError.custom(
        'Video title exceeds maximum length',
        'title',
        'maximum 100 characters',
        `${metadata.title.length} characters`
      );
    }

    if (metadata.description && metadata.description.length > 5000) {
      throw ValidationError.custom(
        'Video description exceeds maximum length',
        'description',
        'maximum 5000 characters',
        `${metadata.description.length} characters`
      );
    }

    if (metadata.tags) {
      const totalTagLength = metadata.tags.join(',').length;
      if (totalTagLength > 500) {
        throw ValidationError.custom(
          'Total tag length exceeds maximum',
          'tags',
          'maximum 500 characters total',
          `${totalTagLength} characters`
        );
      }

      // Check individual tag lengths
      for (const tag of metadata.tags) {
        if (tag.length > 30) {
          throw ValidationError.custom(
            'Individual tag exceeds maximum length',
            'tags',
            'maximum 30 characters per tag',
            `"${tag}" is ${tag.length} characters`
          );
        }
      }
    }
  }

  /**
   * Validate scheduling constraints
   */
  static validateScheduling(options: {
    startDate?: string;
    endDate?: string;
    videoCount: number;
    timeSlots: string[];
  }): void {
    const { startDate, endDate, videoCount, timeSlots } = options;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        throw ValidationError.businessRuleViolation(
          'Start date must be before end date',
          'date_range_validation'
        );
      }

      // Check if enough time slots are available
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const availableSlots = daysDiff * timeSlots.length;

      if (videoCount > availableSlots) {
        throw ValidationError.businessRuleViolation(
          `Not enough time slots available: ${videoCount} videos need ${availableSlots} available slots`,
          'insufficient_time_slots'
        );
      }
    }

    // Validate time slot format (HH:MM)
    for (const timeSlot of timeSlots) {
      if (!/^\d{2}:\d{2}$/.test(timeSlot)) {
        throw ValidationError.custom(
          'Invalid time slot format',
          'timeSlots',
          'HH:MM format (e.g., "09:00")',
          timeSlot
        );
      }
    }
  }

  /**
   * Validate batch operation constraints
   */
  static validateBatchOperation(options: {
    itemCount: number;
    batchType: string;
  }): void {
    const { itemCount, batchType } = options;

    // Set different limits based on batch type
    const limits: Record<string, number> = {
      metadata_update: 50,
      schedule_videos: 100,
      playlist_management: 200
    };

    const limit = limits[batchType] || 50;

    if (itemCount > limit) {
      throw ValidationError.businessRuleViolation(
        `Batch size exceeds limit for ${batchType}: ${itemCount} > ${limit}`,
        'batch_size_limit'
      );
    }

    if (itemCount === 0) {
      throw ValidationError.businessRuleViolation(
        'Batch operation must contain at least one item',
        'empty_batch'
      );
    }
  }

  /**
   * Validate OAuth scopes for operation
   */
  static validateOAuthScopes(
    requiredScopes: string[],
    availableScopes: string[]
  ): void {
    const missingScopes = requiredScopes.filter(
      scope => !availableScopes.includes(scope)
    );

    if (missingScopes.length > 0) {
      throw ValidationError.businessRuleViolation(
        `Missing required OAuth scopes: ${missingScopes.join(', ')}`,
        'insufficient_oauth_scopes',
        {
          metadata: {
            requiredScopes,
            availableScopes,
            missingScopes
          }
        }
      );
    }
  }
}

/**
 * Conditional validation helpers
 */
export class ConditionalValidator {
  /**
   * Validate that required fields are present when strategy is manual
   */
  static validateManualPlaylistStrategy(input: {
    strategy?: string;
    groups?: Array<{
      playlistId?: string;
      playlistTitle?: string;
      videoIds?: string[];
    }>;
  }): void {
    if (input.strategy === 'manual') {
      if (!input.groups || input.groups.length === 0) {
        throw ValidationError.custom(
          'Manual strategy requires at least one group',
          'groups',
          'array with at least one group',
          input.groups
        );
      }

      for (let i = 0; i < input.groups.length; i++) {
        const group = input.groups[i];
        if (!group.playlistId && !group.playlistTitle) {
          throw ValidationError.custom(
            `Group ${i + 1} must have either playlistId or playlistTitle`,
            `groups[${i}]`,
            'playlistId or playlistTitle',
            'neither provided'
          );
        }

        if (!group.videoIds || group.videoIds.length === 0) {
          throw ValidationError.custom(
            `Group ${i + 1} must contain at least one video ID`,
            `groups[${i}].videoIds`,
            'array with at least one video ID',
            group.videoIds
          );
        }
      }
    }
  }

  /**
   * Validate that suggestion ID is provided when acknowledging guardrails
   */
  static validateGuardrailAcknowledgment(input: {
    suggestionId?: string;
    acknowledgedGuardrails?: boolean;
  }): void {
    if (input.acknowledgedGuardrails && !input.suggestionId) {
      throw ValidationError.custom(
        'Guardrail acknowledgment requires a suggestion ID',
        'suggestionId',
        'valid suggestion ID when acknowledging guardrails',
        'undefined'
      );
    }
  }

  /**
   * Validate backup restore parameters
   */
  static validateBackupRestore(input: {
    videoIds?: string[];
    includeAllVideos?: boolean;
  }): void {
    if (!input.videoIds && !input.includeAllVideos) {
      throw ValidationError.custom(
        'Must specify either videoIds or includeAllVideos',
        'input',
        'videoIds array or includeAllVideos=true',
        'neither provided'
      );
    }

    if (input.videoIds && input.includeAllVideos) {
      throw ValidationError.custom(
        'Cannot specify both videoIds and includeAllVideos',
        'input',
        'either videoIds or includeAllVideos, not both',
        'both provided'
      );
    }
  }
}

/**
 * Create comprehensive input validator that includes business rules
 */
export function createComprehensiveValidator<T>(
  schema: ZodSchema<T>,
  toolName: string,
  businessRules?: (input: T) => void
) {
  return (input: unknown, userId?: string): T => {
    // First validate against schema
    const validated = validateMCPInput(schema, input, {
      toolName,
      operationType: 'comprehensive_validation',
      userId
    });

    // Then apply business rules if provided
    if (businessRules) {
      try {
        businessRules(validated);
      } catch (error) {
        if (error instanceof ValidationError) {
          // Re-throw with additional context
          throw new ValidationError(
            error.message,
            error.validationErrorType,
            error.issues,
            {
              ...error.context,
              operation: `business_rules_${toolName}`,
              userId,
              metadata: {
                ...error.context.metadata,
                toolName,
                validationPhase: 'business_rules'
              }
            }
          );
        }
        throw error;
      }
    }

    return validated;
  };
}