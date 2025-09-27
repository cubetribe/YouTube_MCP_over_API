/**
 * Error handling middleware for the MCP server
 * Provides centralized error processing, logging, and response formatting
 */

import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../lib/logger.js';
import { BaseError } from './base-error.js';
import { OAuthError } from './oauth-error.js';
import { YouTubeAPIError } from './youtube-api-error.js';
import { ValidationError } from './validation-error.js';
import { BatchProcessingError } from './batch-processing-error.js';
import { ErrorFactory } from './error-factory.js';
import { ErrorRecoveryOrchestrator } from './error-recovery.js';

export interface ErrorHandler {
  (error: Error, request: CallToolRequest): Promise<MCPErrorResponse>;
}

export interface MCPErrorResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Main error middleware that processes all errors in MCP tool handlers
 */
export async function errorMiddleware(
  error: Error,
  request: CallToolRequest,
  retryOperation?: () => Promise<any>
): Promise<MCPErrorResponse> {
  const { name: toolName, arguments: args = {} } = request.params;
  const correlationId = generateCorrelationId();

  // Convert unknown errors to our error types
  const standardizedError = error instanceof BaseError
    ? error
    : ErrorFactory.fromUnknownError(error, {
        operation: `tool_${toolName}`,
        metadata: {
          toolName,
          correlationId,
          requestArgs: Object.keys(args)
        }
      });

  // Log the error with full context
  await logError(standardizedError, toolName, correlationId, args);

  // Attempt error recovery if retry operation is provided
  if (retryOperation && standardizedError.canRetry()) {
    try {
      logger.info(
        `Attempting error recovery for ${toolName}`,
        'system',
        {
          toolName,
          correlationId,
          errorType: standardizedError.constructor.name,
          retryCount: standardizedError.retryCount
        }
      );

      const result = await ErrorRecoveryOrchestrator.handleError(
        standardizedError,
        retryOperation
      );

      // If recovery succeeded, return the result
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (recoveryError) {
      // Recovery failed, log and continue with error response
      logger.error(
        `Error recovery failed for ${toolName}`,
        'system',
        recoveryError,
        {
          toolName,
          correlationId,
          originalError: standardizedError.constructor.name,
          recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
        }
      );

      // Use the recovery error if it's more specific
      if (recoveryError instanceof BaseError) {
        standardizedError = recoveryError;
      }
    }
  }

  // Generate user-friendly error response
  return generateErrorResponse(standardizedError, toolName, correlationId);
}

/**
 * Log error with appropriate level and context
 */
async function logError(
  error: BaseError,
  toolName: string,
  correlationId: string,
  requestArgs: Record<string, unknown>
): Promise<void> {
  const severity = error.getSeverity();
  const logLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'error' : 'warn';

  const logContext = {
    correlationId,
    toolName,
    errorType: error.constructor.name,
    errorCode: error.code,
    errorId: error.errorId,
    severity,
    retryable: error.canRetry(),
    retryCount: error.retryCount,
    operation: error.context.operation,
    userId: error.context.userId,
    metadata: {
      ...error.context.metadata,
      requestArgsKeys: Object.keys(requestArgs),
      stackTrace: error.stack?.split('\n').slice(0, 5) // First 5 lines of stack
    }
  };

  if (logLevel === 'error') {
    logger.error(
      `Tool execution failed: ${toolName}`,
      'api',
      error,
      logContext
    );
  } else {
    logger.warn(
      `Tool execution warning: ${toolName}`,
      'api',
      logContext
    );
  }

  // Log performance impact for monitoring
  logger.recordPerformance({
    operationType: `tool_${toolName}`,
    duration: 0, // Would need to be tracked by caller
    success: false,
    quotaCost: getQuotaCostFromError(error),
    timestamp: new Date().toISOString(),
    correlationId
  });

  // Log audit trail for critical errors
  if (severity === 'critical' || severity === 'high') {
    logger.audit({
      userId: error.context.userId,
      action: 'tool_execution_failed',
      resource: 'mcp_tool',
      resourceId: toolName,
      correlationId,
      oldValues: { status: 'executing' },
      newValues: {
        status: 'failed',
        errorType: error.constructor.name,
        errorCode: error.code
      }
    });
  }
}

/**
 * Generate user-friendly error response for MCP client
 */
function generateErrorResponse(
  error: BaseError,
  toolName: string,
  correlationId: string
): MCPErrorResponse {
  const userMessage = error.getUserMessage();
  const recoveryActions = error.getRecoveryActions();
  const severity = error.getSeverity();

  // Base error response
  const errorResponse = {
    error: {
      type: error.constructor.name,
      code: error.code,
      message: userMessage,
      correlationId,
      severity,
      timestamp: error.timestamp,
      retryable: error.canRetry()
    },
    tool: toolName,
    suggestions: recoveryActions
  };

  // Add specific details based on error type
  if (error instanceof OAuthError) {
    errorResponse.error = {
      ...errorResponse.error,
      authenticationRequired: error.requiresReauth(),
      shouldClearTokens: error.shouldClearTokens(),
      oauthErrorType: error.oauthErrorType
    };
  }

  if (error instanceof YouTubeAPIError) {
    errorResponse.error = {
      ...errorResponse.error,
      httpStatus: error.details.status,
      quotaRelated: error.isQuotaRelated(),
      permissionRelated: error.isPermissionRelated(),
      youtubeErrorType: error.apiErrorType
    };

    // Add quota information if available
    if (error.details.quotaCost) {
      errorResponse.error = {
        ...errorResponse.error,
        quotaCost: error.details.quotaCost
      };
    }
  }

  if (error instanceof ValidationError) {
    errorResponse.error = {
      ...errorResponse.error,
      validationReport: error.getValidationReport(),
      validationErrorType: error.validationErrorType
    };
  }

  if (error instanceof BatchProcessingError) {
    const stats = error.getProcessingStats();
    errorResponse.error = {
      ...errorResponse.error,
      batchStats: stats,
      canResume: error.canResume(),
      canRetryItems: error.canRetryItems(),
      batchErrorType: error.batchErrorType
    };

    if (error.canRetryItems()) {
      errorResponse.error = {
        ...errorResponse.error,
        failedItemIds: error.getFailedItemIds()
      };
    }
  }

  // Add debug information for development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = {
      ...errorResponse.error,
      debug: {
        stackTrace: error.stack,
        context: error.context,
        errorId: error.errorId
      }
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(errorResponse, null, 2)
    }],
    isError: true
  };
}

/**
 * Extract quota cost from error if available
 */
function getQuotaCostFromError(error: BaseError): number {
  if (error instanceof YouTubeAPIError && error.details.quotaCost) {
    return error.details.quotaCost;
  }
  return 0;
}

/**
 * Generate correlation ID for tracking
 */
function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `mcp_${timestamp}_${random}`;
}

/**
 * Specialized error handlers for different scenarios
 */
export class SpecializedErrorHandlers {
  /**
   * Handle authentication errors with re-auth guidance
   */
  static async handleAuthenticationError(
    error: OAuthError,
    toolName: string
  ): Promise<MCPErrorResponse> {
    const correlationId = generateCorrelationId();

    // Log authentication failure for security monitoring
    logger.warn(
      `Authentication error in ${toolName}`,
      'auth',
      {
        correlationId,
        toolName,
        oauthErrorType: error.oauthErrorType,
        requiresReauth: error.requiresReauth(),
        shouldClearTokens: error.shouldClearTokens()
      }
    );

    const response = {
      error: {
        type: 'AuthenticationError',
        code: error.code,
        message: error.getUserMessage(),
        correlationId,
        severity: error.getSeverity(),
        authenticationRequired: true,
        nextSteps: [
          'Run start_oauth_flow to begin authentication',
          'Complete authentication in browser',
          'Run complete_oauth_flow with authorization code',
          'Retry the original operation'
        ]
      },
      tool: toolName,
      suggestions: error.getRecoveryActions()
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }],
      isError: true
    };
  }

  /**
   * Handle quota exceeded with helpful timing information
   */
  static async handleQuotaExceeded(
    error: YouTubeAPIError,
    toolName: string
  ): Promise<MCPErrorResponse> {
    const correlationId = generateCorrelationId();

    // Calculate when quota might reset (typically midnight Pacific Time)
    const now = new Date();
    const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    const tomorrow = new Date(pacificTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const hoursUntilReset = Math.ceil((tomorrow.getTime() - pacificTime.getTime()) / (1000 * 60 * 60));

    const response = {
      error: {
        type: 'QuotaExceededError',
        code: error.code,
        message: error.getUserMessage(),
        correlationId,
        severity: 'critical',
        quotaInfo: {
          quotaUsed: error.details.quotaCost || 'unknown',
          estimatedResetTime: tomorrow.toISOString(),
          hoursUntilReset,
          timeZone: 'America/Los_Angeles'
        }
      },
      tool: toolName,
      suggestions: [
        `Wait ${hoursUntilReset} hours for quota reset`,
        'Consider reducing batch sizes to conserve quota',
        'Implement quota monitoring to prevent future overages',
        'Review API usage patterns for optimization opportunities'
      ]
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }],
      isError: true
    };
  }

  /**
   * Handle validation errors with detailed field guidance
   */
  static async handleValidationError(
    error: ValidationError,
    toolName: string
  ): Promise<MCPErrorResponse> {
    const correlationId = generateCorrelationId();
    const validationReport = error.getValidationReport();

    const response = {
      error: {
        type: 'ValidationError',
        code: error.code,
        message: error.getUserMessage(),
        correlationId,
        severity: error.getSeverity(),
        validation: {
          summary: validationReport.summary,
          totalErrors: validationReport.totalErrors,
          fieldErrors: validationReport.fieldErrors,
          suggestions: validationReport.suggestions
        }
      },
      tool: toolName,
      suggestions: error.getRecoveryActions()
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }],
      isError: true
    };
  }
}