/**
 * Input validation and schema-related error handling
 */

import { ZodError, ZodIssue } from 'zod';
import { BaseError, type ErrorContext, type RetryConfig } from './base-error.js';

export type ValidationErrorType =
  | 'SCHEMA_VALIDATION'
  | 'REQUIRED_FIELD_MISSING'
  | 'INVALID_FORMAT'
  | 'VALUE_OUT_OF_RANGE'
  | 'INVALID_ENUM_VALUE'
  | 'INVALID_TYPE'
  | 'ARRAY_TOO_SHORT'
  | 'ARRAY_TOO_LONG'
  | 'STRING_TOO_SHORT'
  | 'STRING_TOO_LONG'
  | 'INVALID_REGEX'
  | 'CUSTOM_VALIDATION'
  | 'DUPLICATE_VALUES'
  | 'CONDITIONAL_VALIDATION'
  | 'BUSINESS_RULE_VIOLATION';

export interface ValidationIssue {
  /** Field path where validation failed */
  path: string[];
  /** Error message */
  message: string;
  /** Expected value or format */
  expected?: string;
  /** Actual value received */
  received?: unknown;
  /** Validation rule that failed */
  rule?: string;
}

export class ValidationError extends BaseError {
  public readonly issues: ValidationIssue[];

  constructor(
    message: string,
    public readonly validationErrorType: ValidationErrorType,
    issues: ValidationIssue[] = [],
    context: ErrorContext = {}
  ) {
    // Validation errors are generally not retryable unless they're business rule violations
    const retryConfig: RetryConfig = {
      retryable: validationErrorType === 'BUSINESS_RULE_VIOLATION',
      maxRetries: validationErrorType === 'BUSINESS_RULE_VIOLATION' ? 1 : 0
    };

    super(message, `VALIDATION_${validationErrorType}`, context, retryConfig);
    this.issues = issues;
  }

  /**
   * Create ValidationError from Zod error
   */
  public static fromZodError(zodError: ZodError, context: ErrorContext = {}): ValidationError {
    const issues: ValidationIssue[] = zodError.issues.map(issue => ({
      path: issue.path.map(p => String(p)),
      message: issue.message,
      expected: ValidationError.getExpectedFromZodIssue(issue),
      received: issue.received,
      rule: issue.code
    }));

    const primaryIssue = issues[0];
    const errorType = ValidationError.mapZodCodeToErrorType(zodError.issues[0].code);

    const message = issues.length === 1
      ? `Validation failed for ${primaryIssue.path.join('.')}: ${primaryIssue.message}`
      : `Validation failed with ${issues.length} errors`;

    return new ValidationError(message, errorType, issues, {
      ...context,
      metadata: {
        zodError: zodError.flatten(),
        fieldCount: issues.length
      }
    });
  }

  /**
   * Create ValidationError for business rule violations
   */
  public static businessRuleViolation(
    message: string,
    rule: string,
    context: ErrorContext = {}
  ): ValidationError {
    return new ValidationError(
      message,
      'BUSINESS_RULE_VIOLATION',
      [{
        path: [],
        message,
        rule
      }],
      {
        ...context,
        metadata: { businessRule: rule }
      }
    );
  }

  /**
   * Create ValidationError for custom validation
   */
  public static custom(
    message: string,
    field: string,
    expected?: string,
    received?: unknown,
    context: ErrorContext = {}
  ): ValidationError {
    return new ValidationError(
      message,
      'CUSTOM_VALIDATION',
      [{
        path: [field],
        message,
        expected,
        received
      }],
      context
    );
  }

  private static mapZodCodeToErrorType(code: string): ValidationErrorType {
    switch (code) {
      case 'invalid_type':
        return 'INVALID_TYPE';
      case 'invalid_string':
        return 'INVALID_FORMAT';
      case 'too_small':
        return 'VALUE_OUT_OF_RANGE';
      case 'too_big':
        return 'VALUE_OUT_OF_RANGE';
      case 'invalid_enum_value':
        return 'INVALID_ENUM_VALUE';
      case 'invalid_date':
        return 'INVALID_FORMAT';
      case 'custom':
        return 'CUSTOM_VALIDATION';
      default:
        return 'SCHEMA_VALIDATION';
    }
  }

  private static getExpectedFromZodIssue(issue: ZodIssue): string | undefined {
    switch (issue.code) {
      case 'invalid_type':
        return `type ${issue.expected}`;
      case 'invalid_enum_value':
        return `one of: ${issue.options?.join(', ')}`;
      case 'too_small':
        if (issue.type === 'string') {
          return `minimum ${issue.minimum} characters`;
        } else if (issue.type === 'array') {
          return `minimum ${issue.minimum} items`;
        } else {
          return `minimum value ${issue.minimum}`;
        }
      case 'too_big':
        if (issue.type === 'string') {
          return `maximum ${issue.maximum} characters`;
        } else if (issue.type === 'array') {
          return `maximum ${issue.maximum} items`;
        } else {
          return `maximum value ${issue.maximum}`;
        }
      case 'invalid_string':
        if (issue.validation === 'email') {
          return 'valid email address';
        } else if (issue.validation === 'url') {
          return 'valid URL';
        } else if (issue.validation === 'regex') {
          return 'string matching required pattern';
        }
        return 'valid string format';
      default:
        return undefined;
    }
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.validationErrorType) {
      case 'REQUIRED_FIELD_MISSING':
        return 'high';
      case 'BUSINESS_RULE_VIOLATION':
        return 'medium';
      case 'INVALID_TYPE':
      case 'INVALID_FORMAT':
        return 'medium';
      default:
        return 'low';
    }
  }

  public getRecoveryActions(): string[] {
    const actions: string[] = [];

    // Add specific actions based on validation type
    switch (this.validationErrorType) {
      case 'REQUIRED_FIELD_MISSING':
        actions.push('Provide all required fields');
        break;
      case 'INVALID_FORMAT':
        actions.push('Check data format and correct invalid values');
        break;
      case 'VALUE_OUT_OF_RANGE':
        actions.push('Ensure values are within acceptable ranges');
        break;
      case 'INVALID_ENUM_VALUE':
        actions.push('Use only allowed values from the specified options');
        break;
      case 'BUSINESS_RULE_VIOLATION':
        actions.push('Review business rules and adjust inputs accordingly');
        break;
    }

    // Add field-specific guidance
    for (const issue of this.issues) {
      if (issue.expected) {
        actions.push(`${issue.path.join('.')}: ${issue.expected}`);
      }
    }

    if (actions.length === 0) {
      actions.push('Review input data and correct validation errors');
    }

    return actions;
  }

  public getUserMessage(): string {
    if (this.issues.length === 1) {
      const issue = this.issues[0];
      const fieldName = issue.path.length > 0 ? issue.path.join('.') : 'input';
      return `Invalid ${fieldName}: ${issue.message}`;
    }

    const fieldNames = this.issues
      .map(issue => issue.path.length > 0 ? issue.path.join('.') : 'field')
      .filter((name, index, array) => array.indexOf(name) === index)
      .slice(0, 3);

    if (fieldNames.length === this.issues.length && fieldNames.length <= 3) {
      return `Invalid fields: ${fieldNames.join(', ')}`;
    }

    return `${this.issues.length} validation errors found in input data`;
  }

  /**
   * Get detailed validation report
   */
  public getValidationReport(): {
    summary: string;
    totalErrors: number;
    fieldErrors: Record<string, string[]>;
    suggestions: string[];
  } {
    const fieldErrors: Record<string, string[]> = {};
    const suggestions: string[] = [];

    for (const issue of this.issues) {
      const fieldPath = issue.path.join('.') || 'root';
      if (!fieldErrors[fieldPath]) {
        fieldErrors[fieldPath] = [];
      }
      fieldErrors[fieldPath].push(issue.message);

      if (issue.expected) {
        suggestions.push(`${fieldPath}: Expected ${issue.expected}`);
      }
    }

    return {
      summary: this.getUserMessage(),
      totalErrors: this.issues.length,
      fieldErrors,
      suggestions: Array.from(new Set(suggestions))
    };
  }

  /**
   * Check if validation failed for a specific field
   */
  public hasFieldError(fieldPath: string): boolean {
    return this.issues.some(issue =>
      issue.path.join('.') === fieldPath
    );
  }

  /**
   * Get errors for a specific field
   */
  public getFieldErrors(fieldPath: string): ValidationIssue[] {
    return this.issues.filter(issue =>
      issue.path.join('.') === fieldPath
    );
  }

  /**
   * Check if this is a critical validation error that should stop processing
   */
  public isCritical(): boolean {
    const criticalTypes: ValidationErrorType[] = [
      'REQUIRED_FIELD_MISSING',
      'INVALID_TYPE',
      'BUSINESS_RULE_VIOLATION'
    ];
    return criticalTypes.includes(this.validationErrorType);
  }
}