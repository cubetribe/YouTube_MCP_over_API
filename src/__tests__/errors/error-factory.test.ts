import { describe, it, expect } from 'vitest';
import { ErrorFactory } from '../../errors/error-factory.js';
import { YouTubeAPIError } from '../../errors/youtube-api-error.js';
import { OAuthError } from '../../errors/oauth-error.js';
import { ValidationError } from '../../errors/validation-error.js';
import { BatchProcessingError } from '../../errors/batch-processing-error.js';

describe('ErrorFactory', () => {
  describe('createYouTubeError', () => {
    it('should create YouTube API error with basic information', () => {
      const error = ErrorFactory.createYouTubeError(
        'Video not found',
        404,
        'videoNotFound'
      );

      expect(error).toBeInstanceOf(YouTubeAPIError);
      expect(error.message).toBe('Video not found');
      expect(error.statusCode).toBe(404);
      expect(error.reason).toBe('videoNotFound');
      expect(error.name).toBe('YouTubeAPIError');
    });

    it('should create YouTube API error with detailed information', () => {
      const error = ErrorFactory.createYouTubeError(
        'Quota exceeded',
        429,
        'quotaExceeded',
        {
          domain: 'youtube.quota',
          location: 'q',
          locationType: 'parameter',
        }
      );

      expect(error).toBeInstanceOf(YouTubeAPIError);
      expect(error.message).toBe('Quota exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.reason).toBe('quotaExceeded');
      expect(error.details).toEqual({
        domain: 'youtube.quota',
        location: 'q',
        locationType: 'parameter',
      });
    });

    it('should handle undefined optional parameters', () => {
      const error = ErrorFactory.createYouTubeError('Generic error', 500);

      expect(error).toBeInstanceOf(YouTubeAPIError);
      expect(error.message).toBe('Generic error');
      expect(error.statusCode).toBe(500);
      expect(error.reason).toBeUndefined();
      expect(error.details).toBeUndefined();
    });
  });

  describe('createOAuthError', () => {
    it('should create OAuth error with basic information', () => {
      const error = ErrorFactory.createOAuthError(
        'Invalid credentials',
        'invalid_client'
      );

      expect(error).toBeInstanceOf(OAuthError);
      expect(error.message).toBe('Invalid credentials');
      expect(error.errorCode).toBe('invalid_client');
      expect(error.name).toBe('OAuthError');
    });

    it('should create OAuth error with additional context', () => {
      const context = {
        redirect_uri: 'http://localhost:3000/callback',
        client_id: 'test-client-id',
      };

      const error = ErrorFactory.createOAuthError(
        'Invalid redirect URI',
        'invalid_request',
        context
      );

      expect(error).toBeInstanceOf(OAuthError);
      expect(error.message).toBe('Invalid redirect URI');
      expect(error.errorCode).toBe('invalid_request');
      expect(error.context).toEqual(context);
    });

    it('should handle undefined optional parameters', () => {
      const error = ErrorFactory.createOAuthError('Unknown error');

      expect(error).toBeInstanceOf(OAuthError);
      expect(error.message).toBe('Unknown error');
      expect(error.errorCode).toBeUndefined();
      expect(error.context).toBeUndefined();
    });
  });

  describe('createValidationError', () => {
    it('should create validation error with field and value', () => {
      const error = ErrorFactory.createValidationError(
        'title',
        'Test Title',
        'Title must be less than 100 characters'
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Title must be less than 100 characters');
      expect(error.field).toBe('title');
      expect(error.value).toBe('Test Title');
      expect(error.name).toBe('ValidationError');
    });

    it('should create validation error with constraints', () => {
      const constraints = {
        minLength: 5,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\s]+$/,
      };

      const error = ErrorFactory.createValidationError(
        'title',
        'A',
        'Title is too short',
        constraints
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Title is too short');
      expect(error.field).toBe('title');
      expect(error.value).toBe('A');
      expect(error.constraints).toEqual(constraints);
    });

    it('should handle undefined optional parameters', () => {
      const error = ErrorFactory.createValidationError(
        'email',
        'invalid-email',
        'Invalid email format'
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid email format');
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
      expect(error.constraints).toBeUndefined();
    });

    it('should handle complex value types', () => {
      const complexValue = {
        title: 'Test',
        tags: ['tag1', 'tag2'],
        metadata: { category: 'education' },
      };

      const error = ErrorFactory.createValidationError(
        'videoData',
        complexValue,
        'Invalid video data structure'
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.field).toBe('videoData');
      expect(error.value).toEqual(complexValue);
    });
  });

  describe('createBatchError', () => {
    it('should create batch processing error with basic information', () => {
      const error = ErrorFactory.createBatchError(
        'batch-123',
        'Batch processing failed'
      );

      expect(error).toBeInstanceOf(BatchProcessingError);
      expect(error.message).toBe('Batch processing failed');
      expect(error.batchId).toBe('batch-123');
      expect(error.name).toBe('BatchProcessingError');
    });

    it('should create batch processing error with failed operations', () => {
      const failedOperations = [
        {
          id: 'op-1',
          error: 'Video not found',
          videoId: 'video-123',
        },
        {
          id: 'op-3',
          error: 'Quota exceeded',
          videoId: 'video-456',
        },
      ];

      const error = ErrorFactory.createBatchError(
        'batch-456',
        'Multiple operations failed',
        failedOperations
      );

      expect(error).toBeInstanceOf(BatchProcessingError);
      expect(error.message).toBe('Multiple operations failed');
      expect(error.batchId).toBe('batch-456');
      expect(error.failedOperations).toEqual(failedOperations);
    });

    it('should create batch processing error with context', () => {
      const context = {
        totalOperations: 10,
        successfulOperations: 7,
        failedOperations: 3,
        batchType: 'schedule_videos',
      };

      const error = ErrorFactory.createBatchError(
        'batch-789',
        'Batch partially failed',
        undefined,
        context
      );

      expect(error).toBeInstanceOf(BatchProcessingError);
      expect(error.message).toBe('Batch partially failed');
      expect(error.batchId).toBe('batch-789');
      expect(error.context).toEqual(context);
    });

    it('should handle undefined optional parameters', () => {
      const error = ErrorFactory.createBatchError(
        'batch-minimal',
        'Simple batch error'
      );

      expect(error).toBeInstanceOf(BatchProcessingError);
      expect(error.message).toBe('Simple batch error');
      expect(error.batchId).toBe('batch-minimal');
      expect(error.failedOperations).toBeUndefined();
      expect(error.context).toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('should create errors with consistent properties', () => {
      const errors = [
        ErrorFactory.createYouTubeError('YouTube error', 400),
        ErrorFactory.createOAuthError('OAuth error'),
        ErrorFactory.createValidationError('field', 'value', 'Validation error'),
        ErrorFactory.createBatchError('batch-1', 'Batch error'),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.name).toBeDefined();
        expect(error.stack).toBeDefined();
      });
    });

    it('should create errors that can be JSON serialized', () => {
      const youtubeError = ErrorFactory.createYouTubeError(
        'API error',
        429,
        'quotaExceeded',
        { domain: 'youtube' }
      );

      const oauthError = ErrorFactory.createOAuthError(
        'Auth error',
        'invalid_grant',
        { grant_type: 'authorization_code' }
      );

      const validationError = ErrorFactory.createValidationError(
        'title',
        'invalid',
        'Validation failed',
        { minLength: 5 }
      );

      const batchError = ErrorFactory.createBatchError(
        'batch-1',
        'Batch failed',
        [{ id: 'op-1', error: 'Failed' }],
        { type: 'schedule' }
      );

      // Should not throw when serializing
      expect(() => JSON.stringify(youtubeError)).not.toThrow();
      expect(() => JSON.stringify(oauthError)).not.toThrow();
      expect(() => JSON.stringify(validationError)).not.toThrow();
      expect(() => JSON.stringify(batchError)).not.toThrow();
    });

    it('should create errors with proper inheritance chain', () => {
      const youtubeError = ErrorFactory.createYouTubeError('YouTube error', 400);
      const oauthError = ErrorFactory.createOAuthError('OAuth error');
      const validationError = ErrorFactory.createValidationError('field', 'value', 'Validation error');
      const batchError = ErrorFactory.createBatchError('batch-1', 'Batch error');

      // All should be instances of Error
      expect(youtubeError instanceof Error).toBe(true);
      expect(oauthError instanceof Error).toBe(true);
      expect(validationError instanceof Error).toBe(true);
      expect(batchError instanceof Error).toBe(true);

      // Should be instances of their specific types
      expect(youtubeError instanceof YouTubeAPIError).toBe(true);
      expect(oauthError instanceof OAuthError).toBe(true);
      expect(validationError instanceof ValidationError).toBe(true);
      expect(batchError instanceof BatchProcessingError).toBe(true);
    });

    it('should handle edge cases gracefully', () => {
      // Empty strings
      const emptyYouTube = ErrorFactory.createYouTubeError('', 0);
      expect(emptyYouTube.message).toBe('');
      expect(emptyYouTube.statusCode).toBe(0);

      // Null values where possible
      const nullValidation = ErrorFactory.createValidationError('field', null, 'Null value');
      expect(nullValidation.value).toBeNull();

      // Very long strings
      const longMessage = 'A'.repeat(1000);
      const longError = ErrorFactory.createBatchError('batch-long', longMessage);
      expect(longError.message).toBe(longMessage);
      expect(longError.message.length).toBe(1000);
    });

    it('should create errors with unique instances', () => {
      const error1 = ErrorFactory.createYouTubeError('Same message', 400);
      const error2 = ErrorFactory.createYouTubeError('Same message', 400);

      expect(error1).not.toBe(error2);
      expect(error1.message).toBe(error2.message);
      expect(error1.statusCode).toBe(error2.statusCode);
    });
  });

  describe('error properties validation', () => {
    it('should set correct names for all error types', () => {
      const youtubeError = ErrorFactory.createYouTubeError('YouTube error', 400);
      const oauthError = ErrorFactory.createOAuthError('OAuth error');
      const validationError = ErrorFactory.createValidationError('field', 'value', 'Validation error');
      const batchError = ErrorFactory.createBatchError('batch-1', 'Batch error');

      expect(youtubeError.name).toBe('YouTubeAPIError');
      expect(oauthError.name).toBe('OAuthError');
      expect(validationError.name).toBe('ValidationError');
      expect(batchError.name).toBe('BatchProcessingError');
    });

    it('should maintain stack traces', () => {
      const error = ErrorFactory.createYouTubeError('Test error', 400);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('YouTubeAPIError');
      expect(error.stack).toContain('Test error');
    });

    it('should handle special characters in messages', () => {
      const specialChars = 'Error with émojis 🚨 and "quotes" & symbols!';
      const error = ErrorFactory.createValidationError('field', 'value', specialChars);

      expect(error.message).toBe(specialChars);
    });
  });
});