import { describe, expect, it } from 'vitest';

import { metadataService } from '../src/metadata/metadata-service.js';
import type { ParsedTranscript } from '../src/transcript/transcript-manager.js';

describe('MetadataService', () => {
  it('generates suggestions with guardrails and checklist', () => {
    const transcript: ParsedTranscript = {
      videoId: 'video-123',
      language: 'en',
      segments: Array.from({ length: 5 }).map((_, index) => ({
        start: index * 30,
        duration: 25,
        text: `Segment ${index + 1} text about YouTube automation and Claude integration.`,
      })),
    };

    const suggestion = metadataService.generateSuggestion({
      videoId: 'video-123',
      title: 'How to automate YouTube uploads',
      description: 'In diesem Video zeigen wir dir Workflows.',
      tags: ['youtube', 'automation'],
      transcript,
    });

    expect(suggestion).toMatchObject({
      videoId: 'video-123',
      requiresApproval: true,
    });
    expect(suggestion.suggestions.title?.suggested).toContain('How to automate YouTube uploads');
    expect(suggestion.suggestions.description?.timestamps).toHaveLength(5);
    expect(suggestion.guardrails.length).toBeGreaterThan(0);
    expect(suggestion.reviewChecklist.length).toBeGreaterThanOrEqual(3);
    expect(suggestion.recommendedNextSteps.some(text => text.includes('apply_metadata'))).toBe(true);
  });

  it('warns when no transcript timestamps exist', () => {
    const suggestion = metadataService.generateSuggestion({
      videoId: 'video-no-transcript',
      title: 'Titel',
      description: 'Beschreibung',
      tags: [],
    });

    const accuracyGuardrail = suggestion.guardrails.find((guardrail) => guardrail.type === 'accuracy');
    expect(accuracyGuardrail?.status).toBe('warning');
  });
});
