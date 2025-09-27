import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetadataService, type MetadataSource } from '../../metadata/metadata-service.js';
import type { ParsedTranscript } from '../../transcript/transcript-manager.js';

// Mock dependencies
vi.mock('../../lib/audit-logger.js', () => ({
  auditLogger: {
    logMetadataChange: vi.fn(),
    getVideoMetadataHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../utils/timestamp-utils.js', () => ({
  TimestampFormatter: {
    toTimestamp: vi.fn((seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }),
  },
}));

describe('MetadataService', () => {
  let metadataService: MetadataService;
  let mockSource: MetadataSource;
  let mockTranscript: ParsedTranscript;

  beforeEach(() => {
    metadataService = new MetadataService();

    mockTranscript = {
      videoId: 'test-video-id',
      language: 'en',
      segments: [
        { start: 0, duration: 30, text: 'Welcome to this programming tutorial about JavaScript' },
        { start: 30, duration: 45, text: 'Today we will learn about async functions and promises' },
        { start: 75, duration: 60, text: 'Let me show you how to handle errors in asynchronous code' },
        { start: 135, duration: 40, text: 'Here are some best practices for error handling' },
        { start: 175, duration: 35, text: 'Thanks for watching and subscribe for more content' },
      ],
    };

    mockSource = {
      videoId: 'test-video-id',
      title: 'JavaScript Async Programming',
      description: 'Learn async/await in JavaScript with practical examples.',
      tags: ['javascript', 'programming', 'web development'],
      transcript: mockTranscript,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSuggestion', () => {
    it('should generate metadata suggestions from source data', () => {
      const suggestion = metadataService.generateSuggestion(mockSource);

      expect(suggestion).toMatchObject({
        videoId: 'test-video-id',
        originalTitle: 'JavaScript Async Programming',
        originalDescription: 'Learn async/await in JavaScript with practical examples.',
        originalTags: ['javascript', 'programming', 'web development'],
        requiresApproval: true,
      });

      expect(suggestion.generatedAt).toBeDefined();
      expect(suggestion.suggestions.title).toBeDefined();
      expect(suggestion.suggestions.description).toBeDefined();
      expect(suggestion.suggestions.tags).toBeDefined();
    });

    it('should include user and correlation ID in logs when provided', () => {
      const options = {
        userId: 'user123',
        correlationId: 'corr-456',
      };

      metadataService.generateSuggestion(mockSource, options);

      // Check audit logger was called with correct parameters
      const { auditLogger } = require('../../lib/audit-logger.js');
      expect(auditLogger.logMetadataChange).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'test-video-id',
          userId: 'user123',
          correlationId: 'corr-456',
          action: 'generate_suggestion',
        })
      );
    });

    it('should handle source without transcript', () => {
      const sourceWithoutTranscript = {
        ...mockSource,
        transcript: undefined,
      };

      const suggestion = metadataService.generateSuggestion(sourceWithoutTranscript);

      expect(suggestion.suggestions.description.timestamps).toEqual([]);
      expect(suggestion.guardrails).toContainEqual(
        expect.objectContaining({
          type: 'accuracy',
          status: 'warning',
          message: 'Keine Timestamps verfügbar. Prüfe manuell, ob ein Transcript existiert.',
        })
      );
    });

    it('should limit timestamps to 10 entries', () => {
      const largeTranscript = {
        ...mockTranscript,
        segments: Array.from({ length: 15 }, (_, i) => ({
          start: i * 30,
          duration: 30,
          text: `Segment ${i + 1} content with important information`,
        })),
      };

      const sourceWithLargeTranscript = {
        ...mockSource,
        transcript: largeTranscript,
      };

      const suggestion = metadataService.generateSuggestion(sourceWithLargeTranscript);

      expect(suggestion.suggestions.description.timestamps).toHaveLength(10);
    });

    it('should filter out empty transcript segments', () => {
      const transcriptWithEmptySegments = {
        ...mockTranscript,
        segments: [
          { start: 0, duration: 30, text: 'Valid content' },
          { start: 30, duration: 15, text: '' },
          { start: 45, duration: 20, text: '   ' },
          { start: 65, duration: 25, text: 'More valid content' },
        ],
      };

      const sourceWithEmptySegments = {
        ...mockSource,
        transcript: transcriptWithEmptySegments,
      };

      const suggestion = metadataService.generateSuggestion(sourceWithEmptySegments);

      expect(suggestion.suggestions.description.timestamps).toHaveLength(2);
      expect(suggestion.suggestions.description.timestamps[0].description).toBe('Valid content');
      expect(suggestion.suggestions.description.timestamps[1].description).toBe('More valid content');
    });
  });

  describe('title generation', () => {
    it('should enhance title with keywords', () => {
      const suggestion = metadataService.generateSuggestion(mockSource);

      expect(suggestion.suggestions.title.suggested).toContain('JavaScript Async Programming');
      expect(suggestion.suggestions.title.confidence).toBeGreaterThan(0);
      expect(suggestion.suggestions.title.reason).toBeDefined();
    });

    it('should limit title length to 90 characters', () => {
      const longTitleSource = {
        ...mockSource,
        title: 'This is a very long title that definitely exceeds the recommended YouTube title length limit',
      };

      const suggestion = metadataService.generateSuggestion(longTitleSource);

      expect(suggestion.suggestions.title.suggested.length).toBeLessThanOrEqual(90);
    });

    it('should handle titles with special characters', () => {
      const specialTitleSource = {
        ...mockSource,
        title: 'JavaScript: Async/Await & Promises - Part #1',
      };

      const suggestion = metadataService.generateSuggestion(specialTitleSource);

      expect(suggestion.suggestions.title.suggested).toBeDefined();
      expect(typeof suggestion.suggestions.title.suggested).toBe('string');
    });
  });

  describe('description generation', () => {
    it('should enhance description with keywords and timestamps', () => {
      const suggestion = metadataService.generateSuggestion(mockSource);

      const description = suggestion.suggestions.description.suggested;
      expect(description).toContain(mockSource.description);
      expect(description).toContain('Key moments:');
      expect(description).toContain('Highlights:');
      expect(description).toContain('0:00');
    });

    it('should limit description length to 5000 characters', () => {
      const longDescriptionSource = {
        ...mockSource,
        description: 'A'.repeat(4900),
      };

      const suggestion = metadataService.generateSuggestion(longDescriptionSource);

      expect(suggestion.suggestions.description.suggested.length).toBeLessThanOrEqual(5000);
    });

    it('should include timestamps in correct format', () => {
      const suggestion = metadataService.generateSuggestion(mockSource);

      const timestamps = suggestion.suggestions.description.timestamps;
      expect(timestamps).toHaveLength(5);
      expect(timestamps[0]).toMatchObject({
        time: '0:00',
        seconds: 0,
        description: 'Welcome to this programming tutorial about JavaScript',
        importance: 'medium',
      });
    });
  });

  describe('tag generation', () => {
    it('should combine original tags with extracted keywords', () => {
      const suggestion = metadataService.generateSuggestion(mockSource);

      const suggestedTags = suggestion.suggestions.tags.suggested;
      expect(suggestedTags).toContain('javascript');
      expect(suggestedTags).toContain('programming');
      expect(suggestedTags).toContain('web development');
      expect(suggestedTags.length).toBeLessThanOrEqual(15);
    });

    it('should remove duplicate tags', () => {
      const sourceWithDuplicates = {
        ...mockSource,
        tags: ['javascript', 'javascript', 'programming'],
      };

      const suggestion = metadataService.generateSuggestion(sourceWithDuplicates);

      const tagCounts = suggestion.suggestions.tags.suggested.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.values(tagCounts).forEach(count => {
        expect(count).toBe(1);
      });
    });

    it('should handle empty tags array', () => {
      const sourceWithoutTags = {
        ...mockSource,
        tags: [],
      };

      const suggestion = metadataService.generateSuggestion(sourceWithoutTags);

      expect(suggestion.suggestions.tags.suggested).toBeDefined();
      expect(Array.isArray(suggestion.suggestions.tags.suggested)).toBe(true);
    });
  });

  describe('keyword extraction', () => {
    it('should extract keywords from title, description, and transcript', () => {
      const suggestion = metadataService.generateSuggestion(mockSource);

      // Should contain keywords from all sources
      const allText = suggestion.suggestions.tags.suggested.join(' ');
      expect(allText).toMatch(/javascript|programming|async|functions/i);
    });

    it('should filter out short words', () => {
      const sourceWithShortWords = {
        ...mockSource,
        title: 'How to do it in JS',
        description: 'A quick tip for you',
        transcript: {
          ...mockTranscript,
          segments: [
            { start: 0, duration: 30, text: 'I will show you how to do it' },
          ],
        },
      };

      const suggestion = metadataService.generateSuggestion(sourceWithShortWords);

      const suggestedTags = suggestion.suggestions.tags.suggested;
      // Should not contain words with 4 or fewer characters
      suggestedTags.forEach(tag => {
        expect(tag.length).toBeGreaterThan(4);
      });
    });

    it('should handle special characters in text', () => {
      const sourceWithSpecialChars = {
        ...mockSource,
        title: 'C++ vs JavaScript: Performance@2024!',
        description: 'Compare C++ and JavaScript... performance & efficiency.',
      };

      const suggestion = metadataService.generateSuggestion(sourceWithSpecialChars);

      expect(suggestion.suggestions.tags.suggested).toBeDefined();
      expect(Array.isArray(suggestion.suggestions.tags.suggested)).toBe(true);
    });
  });

  describe('guardrails', () => {
    it('should include title length guardrail', () => {
      const suggestion = metadataService.generateSuggestion(mockSource);

      const titleGuardrail = suggestion.guardrails.find(g => g.type === 'length_limits');
      expect(titleGuardrail).toBeDefined();
      expect(titleGuardrail?.status).toBe('pass');
    });

    it('should warn when title exceeds 90 characters', () => {
      const longTitleSource = {
        ...mockSource,
        title: 'This is an extremely long title that definitely exceeds the ninety character limit',
      };

      const suggestion = metadataService.generateSuggestion(longTitleSource);

      const titleGuardrail = suggestion.guardrails.find(g => g.type === 'length_limits');
      expect(titleGuardrail?.status).toBe('warning');
      expect(titleGuardrail?.message).toContain('überschreitet 90 Zeichen');
    });

    it('should include accuracy guardrail for timestamps', () => {
      const suggestion = metadataService.generateSuggestion(mockSource);

      const accuracyGuardrail = suggestion.guardrails.find(g => g.type === 'accuracy');
      expect(accuracyGuardrail).toBeDefined();
      expect(accuracyGuardrail?.status).toBe('pass');
    });

    it('should warn when no timestamps available', () => {
      const sourceWithoutTranscript = {
        ...mockSource,
        transcript: undefined,
      };

      const suggestion = metadataService.generateSuggestion(sourceWithoutTranscript);

      const accuracyGuardrail = suggestion.guardrails.find(g => g.type === 'accuracy');
      expect(accuracyGuardrail?.status).toBe('warning');
      expect(accuracyGuardrail?.message).toContain('Keine Timestamps verfügbar');
    });

    it('should always include manual review guardrail', () => {
      const suggestion = metadataService.generateSuggestion(mockSource);

      const manualGuardrail = suggestion.guardrails.find(g => g.type === 'manual_review');
      expect(manualGuardrail).toBeDefined();
      expect(manualGuardrail?.status).toBe('warning');
      expect(manualGuardrail?.message).toContain('Manuelle Freigabe erforderlich');
    });
  });

  describe('review checklist and next steps', () => {
    it('should include review checklist', () => {
      const suggestion = metadataService.generateSuggestion(mockSource);

      expect(suggestion.reviewChecklist).toBeDefined();
      expect(suggestion.reviewChecklist.length).toBeGreaterThan(0);
      expect(suggestion.reviewChecklist[0]).toContain('Vergleiche den vorgeschlagenen Titel');
    });

    it('should include recommended next steps', () => {
      const suggestion = metadataService.generateSuggestion(mockSource);

      expect(suggestion.recommendedNextSteps).toBeDefined();
      expect(suggestion.recommendedNextSteps.length).toBeGreaterThan(0);
      expect(suggestion.recommendedNextSteps[2]).toContain('apply_metadata');
    });
  });

  describe('logMetadataApplication', () => {
    it('should log metadata application with all parameters', () => {
      const oldMetadata = {
        title: 'Old Title',
        description: 'Old description',
        tags: ['old', 'tags'],
        privacyStatus: 'private',
      };

      const newMetadata = {
        title: 'New Title',
        description: 'New description',
        tags: ['new', 'tags'],
        privacyStatus: 'public',
      };

      const options = {
        userId: 'user123',
        suggestionId: 'suggestion-456',
        guardrailsAcknowledged: true,
        correlationId: 'corr-789',
      };

      metadataService.logMetadataApplication('test-video', oldMetadata, newMetadata, options);

      const { auditLogger } = require('../../lib/audit-logger.js');
      expect(auditLogger.logMetadataChange).toHaveBeenCalledWith({
        videoId: 'test-video',
        userId: 'user123',
        action: 'apply_metadata',
        oldValues: oldMetadata,
        newValues: newMetadata,
        suggestionId: 'suggestion-456',
        guardrailsAcknowledged: true,
        correlationId: 'corr-789',
      });
    });

    it('should work with minimal parameters', () => {
      const oldMetadata = {
        title: 'Old Title',
        description: 'Old description',
        tags: ['old'],
      };

      const newMetadata = {
        title: 'New Title',
      };

      metadataService.logMetadataApplication('test-video', oldMetadata, newMetadata);

      const { auditLogger } = require('../../lib/audit-logger.js');
      expect(auditLogger.logMetadataChange).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'test-video',
          action: 'apply_metadata',
          oldValues: oldMetadata,
          newValues: newMetadata,
        })
      );
    });
  });

  describe('logSuggestionRejection', () => {
    it('should log suggestion rejection with reason', () => {
      const options = {
        userId: 'user123',
        correlationId: 'corr-456',
      };

      metadataService.logSuggestionRejection(
        'test-video',
        'suggestion-123',
        'Not relevant to content',
        options
      );

      const { auditLogger } = require('../../lib/audit-logger.js');
      expect(auditLogger.logMetadataChange).toHaveBeenCalledWith({
        videoId: 'test-video',
        userId: 'user123',
        action: 'reject_suggestion',
        suggestionId: 'suggestion-123',
        correlationId: 'corr-456',
        metadata: { rejectionReason: 'Not relevant to content' },
      });
    });

    it('should work without reason', () => {
      metadataService.logSuggestionRejection('test-video', 'suggestion-123');

      const { auditLogger } = require('../../lib/audit-logger.js');
      expect(auditLogger.logMetadataChange).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'test-video',
          action: 'reject_suggestion',
          suggestionId: 'suggestion-123',
          metadata: { rejectionReason: undefined },
        })
      );
    });
  });

  describe('getMetadataHistory', () => {
    it('should retrieve metadata history for video', async () => {
      const mockHistory = [
        { videoId: 'test-video', action: 'generate_suggestion', timestamp: new Date() },
        { videoId: 'test-video', action: 'apply_metadata', timestamp: new Date() },
      ];

      const { auditLogger } = require('../../lib/audit-logger.js');
      auditLogger.getVideoMetadataHistory.mockResolvedValue(mockHistory);

      const history = await metadataService.getMetadataHistory('test-video');

      expect(history).toEqual(mockHistory);
      expect(auditLogger.getVideoMetadataHistory).toHaveBeenCalledWith('test-video', undefined);
    });

    it('should retrieve metadata history since specific date', async () => {
      const sinceDate = new Date('2024-01-01');
      await metadataService.getMetadataHistory('test-video', sinceDate);

      const { auditLogger } = require('../../lib/audit-logger.js');
      expect(auditLogger.getVideoMetadataHistory).toHaveBeenCalledWith('test-video', sinceDate);
    });
  });

  describe('edge cases', () => {
    it('should handle empty source data', () => {
      const emptySource: MetadataSource = {
        videoId: 'empty-video',
        title: '',
        description: '',
        tags: [],
      };

      const suggestion = metadataService.generateSuggestion(emptySource);

      expect(suggestion.videoId).toBe('empty-video');
      expect(suggestion.suggestions.title.suggested).toBeDefined();
      expect(suggestion.suggestions.description.suggested).toBeDefined();
      expect(suggestion.suggestions.tags.suggested).toBeDefined();
    });

    it('should handle very long content', () => {
      const longSource: MetadataSource = {
        videoId: 'long-video',
        title: 'A'.repeat(200),
        description: 'B'.repeat(10000),
        tags: Array.from({ length: 50 }, (_, i) => `tag${i}`),
        transcript: {
          videoId: 'long-video',
          language: 'en',
          segments: Array.from({ length: 100 }, (_, i) => ({
            start: i * 10,
            duration: 10,
            text: `Segment ${i} with lots of content and keywords`.repeat(5),
          })),
        },
      };

      const suggestion = metadataService.generateSuggestion(longSource);

      expect(suggestion.suggestions.title.suggested.length).toBeLessThanOrEqual(90);
      expect(suggestion.suggestions.description.suggested.length).toBeLessThanOrEqual(5000);
      expect(suggestion.suggestions.tags.suggested.length).toBeLessThanOrEqual(15);
    });

    it('should handle non-English content gracefully', () => {
      const nonEnglishSource: MetadataSource = {
        videoId: 'german-video',
        title: 'Programmierung lernen mit JavaScript',
        description: 'Eine Einführung in die asynchrone Programmierung',
        tags: ['programmierung', 'javascript', 'deutsch'],
        transcript: {
          videoId: 'german-video',
          language: 'de',
          segments: [
            { start: 0, duration: 30, text: 'Willkommen zu diesem Programmier-Tutorial' },
            { start: 30, duration: 40, text: 'Heute lernen wir über asynchrone Funktionen' },
          ],
        },
      };

      const suggestion = metadataService.generateSuggestion(nonEnglishSource);

      expect(suggestion.videoId).toBe('german-video');
      expect(suggestion.suggestions.title.suggested).toBeDefined();
      expect(suggestion.suggestions.description.suggested).toBeDefined();
    });
  });
});