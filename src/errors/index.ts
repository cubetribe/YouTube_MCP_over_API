/**
 * Central exports for the error handling framework
 */

// Base error and types
export { BaseError, type ErrorContext, type RetryConfig } from './base-error.js';

// Specific error classes
export { OAuthError, type OAuthErrorType } from './oauth-error.js';
export {
  YouTubeAPIError,
  type YouTubeAPIErrorType,
  type YouTubeAPIErrorDetails
} from './youtube-api-error.js';
export {
  ValidationError,
  type ValidationErrorType,
  type ValidationIssue
} from './validation-error.js';
export {
  BatchProcessingError,
  type BatchProcessingErrorType,
  type BatchErrorDetails
} from './batch-processing-error.js';

// Recovery mechanisms
export {
  RetryManager,
  CircuitBreaker,
  ErrorRecoveryStrategies,
  ErrorRecoveryOrchestrator,
  type RetryOptions,
  type CircuitBreakerOptions,
  type CircuitBreakerState
} from './error-recovery.js';

// Error middleware
export { errorMiddleware, type ErrorHandler, type MCPErrorResponse } from './middleware.js';

// Validation helpers
export {
  validateMCPInput,
  createInputValidator,
  createComprehensiveValidator,
  BusinessRuleValidator,
  ConditionalValidator
} from './validation-helpers.js';

// Error factory utilities
export { ErrorFactory } from './error-factory.js';

// Legacy compatibility
export { MCPError, AuthenticationError } from '../types/index.js';