import { describe, it, expect } from 'vitest';
import { ThumbnailConceptService } from '../../thumbnail/thumbnail-concept-service.js';
import type { ThumbnailConceptSource } from '../../thumbnail/thumbnail-concept-service.js';
import type { ParsedTranscript } from '../../transcript/transcript-manager.js';

describe('ThumbnailConceptService', () => {
  const service = new ThumbnailConceptService();

  const mockVideoSource: ThumbnailConceptSource = {
    videoId: 'test-video-123',
    title: 'How to Build Amazing React Apps',
    description: 'Learn the secrets of building incredible React applications with this comprehensive tutorial. We\'ll cover best practices, optimization techniques, and advanced patterns.',
    tags: ['react', 'javascript', 'tutorial', 'programming'],
    category: '27', // Education category
    duration: 'PT15M32S',
  };

  const mockTranscript: ParsedTranscript = {
    videoId: 'test-video-123',
    language: 'en',
    segments: [
      { start: 0, duration: 5, text: 'Welcome to this amazing tutorial on React development!' },
      { start: 5, duration: 8, text: 'Today we\'re going to discover some incredible techniques that will blow your mind.' },
      { start: 13, duration: 6, text: 'First, let me show you this awesome optimization trick.' },
      { start: 19, duration: 10, text: 'What you\'re about to see will completely change how you think about React performance.' },
      { start: 29, duration: 7, text: 'The secret is in how we handle state management and component rendering.' },
    ],
  };

  describe('generateConcepts', () => {
    it('should generate multiple thumbnail concepts', () => {
      const result = service.generateConcepts(mockVideoSource);

      expect(result).toBeDefined();
      expect(result.videoId).toBe(mockVideoSource.videoId);
      expect(result.concepts).toBeInstanceOf(Array);
      expect(result.concepts.length).toBeGreaterThan(0);
      expect(result.generatedAt).toBeDefined();
    });

    it('should include content analysis', () => {
      const result = service.generateConcepts(mockVideoSource);

      expect(result.contentAnalysis).toBeDefined();
      expect(result.contentAnalysis.primaryTopics).toBeInstanceOf(Array);
      expect(result.contentAnalysis.emotionalTone).toMatch(/^(positive|negative|neutral|mixed)$/);
      expect(result.contentAnalysis.targetAudience).toBeDefined();
      expect(result.contentAnalysis.keyMoments).toBeInstanceOf(Array);
    });

    it('should provide design guidelines', () => {
      const result = service.generateConcepts(mockVideoSource);

      expect(result.designGuidelines).toBeInstanceOf(Array);
      expect(result.designGuidelines.length).toBeGreaterThan(0);
      expect(result.designGuidelines[0]).toContain('contrast');
    });

    it('should generate concepts with transcript data', () => {
      const sourceWithTranscript = {
        ...mockVideoSource,
        transcript: mockTranscript,
      };

      const result = service.generateConcepts(sourceWithTranscript);

      expect(result.contentAnalysis.keyMoments.length).toBeGreaterThan(0);
      expect(result.concepts.some(concept => concept.keyTimestamp)).toBe(true);
    });

    it('should work without transcript data', () => {
      const sourceWithoutTranscript = {
        ...mockVideoSource,
        transcript: undefined,
      };

      const result = service.generateConcepts(sourceWithoutTranscript);

      expect(result).toBeDefined();
      expect(result.concepts.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('No transcript available - concepts based only on title and description');
    });

    it('should rank concepts by confidence', () => {
      const result = service.generateConcepts(mockVideoSource);

      const confidenceScores = result.concepts.map(concept => concept.confidence);
      const sortedScores = [...confidenceScores].sort((a, b) => b - a);

      expect(confidenceScores).toEqual(sortedScores);
    });

    it('should provide a recommended concept', () => {
      const result = service.generateConcepts(mockVideoSource);

      expect(result.recommendedConcept).toBeDefined();
      expect(result.recommendedConcept).toBeGreaterThanOrEqual(0);
      expect(result.recommendedConcept).toBeLessThan(result.concepts.length);
    });
  });

  describe('concept generation variations', () => {
    it('should generate question-based concepts', () => {
      const result = service.generateConcepts(mockVideoSource);

      const questionConcepts = result.concepts.filter(concept =>
        concept.headline.includes('?') ||
        concept.headline.toLowerCase().startsWith('how') ||
        concept.headline.toLowerCase().startsWith('what') ||
        concept.headline.toLowerCase().startsWith('why')
      );

      expect(questionConcepts.length).toBeGreaterThan(0);
    });

    it('should include visual cues for all concepts', () => {
      const result = service.generateConcepts(mockVideoSource);

      result.concepts.forEach(concept => {
        expect(concept.visualCues).toBeInstanceOf(Array);
        expect(concept.visualCues.length).toBeGreaterThan(0);

        concept.visualCues.forEach(cue => {
          expect(cue.type).toMatch(/^(emotion|object|action|text_overlay|background|composition)$/);
          expect(cue.importance).toMatch(/^(high|medium|low)$/);
          expect(cue.description).toBeDefined();
        });
      });
    });

    it('should include CTA suggestions for all concepts', () => {
      const result = service.generateConcepts(mockVideoSource);

      result.concepts.forEach(concept => {
        expect(concept.ctaSuggestions).toBeInstanceOf(Array);
        expect(concept.ctaSuggestions.length).toBeGreaterThan(0);

        concept.ctaSuggestions.forEach(cta => {
          expect(cta.type).toMatch(/^(question|urgency|curiosity|benefit|emotional)$/);
          expect(cta.placement).toMatch(/^(headline|subtitle|overlay|corner)$/);
          expect(cta.text).toBeDefined();
          expect(cta.effectiveness).toBeGreaterThanOrEqual(0);
          expect(cta.effectiveness).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  describe('content analysis', () => {
    it('should detect positive emotional tone from positive keywords', () => {
      const positiveSource = {
        ...mockVideoSource,
        title: 'Amazing Best Practices for Awesome React Development',
        description: 'This excellent tutorial will show you fantastic techniques for great results',
      };

      const result = service.generateConcepts(positiveSource);
      expect(result.contentAnalysis.emotionalTone).toBe('positive');
    });

    it('should detect negative emotional tone from negative keywords', () => {
      const negativeSource = {
        ...mockVideoSource,
        title: 'Terrible React Mistakes That Will Ruin Your App',
        description: 'Avoid these awful problems and bad practices that cause issues',
      };

      const result = service.generateConcepts(negativeSource);
      expect(result.contentAnalysis.emotionalTone).toBe('negative');
    });

    it('should infer target audience from content', () => {
      const beginnerSource = {
        ...mockVideoSource,
        title: 'React Basics for Beginners - Getting Started',
        description: 'Learn the fundamentals and basic concepts for first-time React developers',
      };

      const result = service.generateConcepts(beginnerSource);
      expect(result.contentAnalysis.targetAudience).toBe('beginner');
    });

    it('should extract topics from content and tags', () => {
      const result = service.generateConcepts(mockVideoSource);

      expect(result.contentAnalysis.primaryTopics).toContain('react');
      expect(result.contentAnalysis.primaryTopics.length).toBeGreaterThan(1);
    });
  });

  describe('key moments extraction', () => {
    it('should identify high-potential moments from transcript', () => {
      const sourceWithTranscript = {
        ...mockVideoSource,
        transcript: mockTranscript,
      };

      const result = service.generateConcepts(sourceWithTranscript);

      expect(result.contentAnalysis.keyMoments.length).toBeGreaterThan(0);

      const highPotentialMoments = result.contentAnalysis.keyMoments.filter(
        moment => moment.thumbnailPotential > 0.5
      );
      expect(highPotentialMoments.length).toBeGreaterThan(0);
    });

    it('should prefer moments with emotional words', () => {
      const emotionalTranscript: ParsedTranscript = {
        videoId: 'test-video-123',
        language: 'en',
        segments: [
          { start: 0, duration: 5, text: 'This is a regular statement about programming and development here with 20 characters.' },
          { start: 5, duration: 8, text: 'This is absolutely amazing and incredible discovery that will show you awesome results!' },
          { start: 100, duration: 6, text: 'Another normal statement about coding here that is longer than twenty characters.' },
        ],
      };

      const sourceWithEmotionalTranscript = {
        ...mockVideoSource,
        transcript: emotionalTranscript,
      };

      const result = service.generateConcepts(sourceWithEmotionalTranscript);

      // Test that we have key moments at all - the second segment should qualify
      // Base: 0.1, emotional (amazing): +0.3, action (show): +0.2, early position: +0.1 = 0.7 total
      expect(result.contentAnalysis.keyMoments.length).toBeGreaterThan(0);

      // Test that emotional moments get higher potential scores
      const emotionalMoment = result.contentAnalysis.keyMoments.find(
        moment => moment.description.includes('amazing')
      );

      expect(emotionalMoment).toBeDefined();
      expect(emotionalMoment!.thumbnailPotential).toBeGreaterThan(0.4);
    });
  });

  describe('warnings and validations', () => {
    it('should warn when no transcript is available', () => {
      const sourceWithoutTranscript = {
        ...mockVideoSource,
        transcript: undefined,
      };

      const result = service.generateConcepts(sourceWithoutTranscript);
      expect(result.warnings).toContain('No transcript available - concepts based only on title and description');
    });

    it('should warn about long titles', () => {
      const longTitleSource = {
        ...mockVideoSource,
        title: 'This is a very long title that exceeds the recommended length for thumbnails and may not display properly on various devices and platforms',
      };

      const result = service.generateConcepts(longTitleSource);
      expect(result.warnings).toContain('Long video title may not fit well in thumbnail - consider shortening');
    });

    it('should filter out low-confidence concepts', () => {
      const result = service.generateConcepts(mockVideoSource);

      result.concepts.forEach(concept => {
        expect(concept.confidence).toBeGreaterThan(0.3);
      });
    });
  });

  describe('concept structure validation', () => {
    it('should ensure all concepts have required fields', () => {
      const result = service.generateConcepts(mockVideoSource);

      result.concepts.forEach(concept => {
        expect(concept.headline).toBeDefined();
        expect(typeof concept.headline).toBe('string');
        expect(concept.headline.length).toBeGreaterThan(0);

        expect(concept.confidence).toBeDefined();
        expect(typeof concept.confidence).toBe('number');
        expect(concept.confidence).toBeGreaterThanOrEqual(0);
        expect(concept.confidence).toBeLessThanOrEqual(1);

        expect(concept.reason).toBeDefined();
        expect(typeof concept.reason).toBe('string');

        expect(concept.visualCues).toBeDefined();
        expect(Array.isArray(concept.visualCues)).toBe(true);

        expect(concept.ctaSuggestions).toBeDefined();
        expect(Array.isArray(concept.ctaSuggestions)).toBe(true);
      });
    });
  });
});