import type { MetadataSuggestion, TimestampEntry } from '../types/index.js';
import type { ParsedTranscript } from '../transcript/transcript-manager.js';
import { TimestampFormatter } from '../utils/timestamp-utils.js';
import { auditLogger } from '../lib/audit-logger.js';
import { logger } from '../lib/logger.js';

export interface MetadataSource {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  transcript?: ParsedTranscript;
}

export class MetadataService {
  generateSuggestion(source: MetadataSource, options: { userId?: string; correlationId?: string } = {}): MetadataSuggestion {
    logger.info(`Generating metadata suggestion for video ${source.videoId}`, 'metadata', {
      videoId: source.videoId,
      userId: options.userId,
      correlationId: options.correlationId,
      hasTranscript: !!source.transcript,
      segmentCount: source.transcript?.segments.length || 0
    });
    const timestampEntries: TimestampEntry[] = (source.transcript?.segments || [])
      .filter(segment => segment.text.trim().length > 0)
      .slice(0, 10)
      .map(segment => ({
        time: TimestampFormatter.toTimestamp(segment.start),
        seconds: segment.start,
        description: segment.text,
        importance: 'medium',
      }));

    const keywords = this.extractKeywords(source);
    const suggestedTitle = this.buildTitle(source.title, keywords);
    const suggestedDescription = this.buildDescription(source.description, keywords, timestampEntries);
    const suggestedTags = Array.from(new Set([...source.tags, ...keywords])).slice(0, 15);

    const guardrails = this.buildGuardrails({
      suggestedTitle,
      suggestedDescription,
      timestampCount: timestampEntries.length,
    });

    const reviewChecklist = [
      'Vergleiche den vorgeschlagenen Titel mit deiner Markenstimme und passe Hooks an.',
      'Überprüfe die ersten 2-3 Sätze der Beschreibung auf klare Call-to-Action Formulierungen.',
      'Stelle sicher, dass die vorgeschlagenen Tags zu deiner aktuellen Keyword-Strategie passen.',
      'Kontrolliere die Timestamps auf inhaltliche Genauigkeit und Länge.',
    ];

    const recommendedNextSteps = [
      'Besprich die Vorschläge mit Claude und nimm ggf. manuelle Anpassungen vor.',
      'Bestätige, dass alle Guardrail-Hinweise abgearbeitet sind.',
      'Rufe `apply_metadata` mit `suggestionId` und `acknowledgedGuardrails=true` auf, um die Änderungen zu übernehmen.',
    ];

    const suggestion = {
      videoId: source.videoId,
      generatedAt: new Date().toISOString(),
      originalTitle: source.title,
      originalDescription: source.description,
      originalTags: source.tags,
      suggestions: {
        title: {
          suggested: suggestedTitle,
          reason: 'Adds context keywords to improve search relevance.',
          confidence: 0.6,
        },
        description: {
          suggested: suggestedDescription,
          reason: 'Highlights main topics and includes quick timestamps.',
          confidence: 0.55,
          improvements: ['Ensure calls to action are present in the first paragraph.'],
          timestamps: timestampEntries,
        },
        tags: {
          suggested: suggestedTags,
          reason: 'Combines existing tags with frequent transcript keywords.',
          confidence: 0.5,
        },
      },
      overallConfidence: 0.55,
      requiresApproval: true,
      guardrails,
      reviewChecklist,
      recommendedNextSteps,
    };

    // Log the metadata suggestion generation
    auditLogger.logMetadataChange({
      videoId: source.videoId,
      userId: options.userId,
      action: 'generate_suggestion',
      oldValues: {
        title: source.title,
        description: source.description,
        tags: source.tags
      },
      newValues: {
        title: suggestedTitle,
        description: suggestedDescription,
        tags: suggestedTags
      },
      correlationId: options.correlationId,
      metadata: {
        overallConfidence: suggestion.overallConfidence,
        timestampCount: timestampEntries.length,
        keywordCount: keywords.length
      }
    });

    return suggestion;
  }

  private buildGuardrails(input: {
    suggestedTitle: string;
    suggestedDescription: string;
    timestampCount: number;
  }) {
    const guardrails = [] as MetadataSuggestion['guardrails'];
    if (input.suggestedTitle.length > 90) {
      guardrails.push({
        type: 'length_limits',
        status: 'warning',
        message: 'Der vorgeschlagene Titel überschreitet 90 Zeichen. Kürze ihn vor dem Upload.',
      });
    } else {
      guardrails.push({
        type: 'length_limits',
        status: 'pass',
        message: 'Titellänge innerhalb der empfohlenen 90 Zeichen.',
      });
    }

    if (input.timestampCount === 0) {
      guardrails.push({
        type: 'accuracy',
        status: 'warning',
        message: 'Keine Timestamps verfügbar. Prüfe manuell, ob ein Transcript existiert.',
      });
    } else {
      guardrails.push({
        type: 'accuracy',
        status: 'pass',
        message: 'Timestamps generiert – bitte kurz gegen das Video prüfen.',
      });
    }

    guardrails.push({
      type: 'manual_review',
      status: 'warning',
      message: 'Manuelle Freigabe erforderlich: bestätige Guardrails vor `apply_metadata`.',
    });

    return guardrails;
  }

  private extractKeywords(source: MetadataSource): string[] {
    const text = `${source.title} ${source.description} ${source.transcript?.segments.map(seg => seg.text).join(' ') ?? ''}`;
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4);

    const counts = new Map<string, number>();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 10);
  }

  /**
   * Apply metadata changes to a video and log the action
   */
  logMetadataApplication(
    videoId: string,
    oldMetadata: { title: string; description: string; tags: string[]; privacyStatus?: string },
    newMetadata: { title?: string; description?: string; tags?: string[]; privacyStatus?: string },
    options: {
      userId?: string;
      suggestionId?: string;
      guardrailsAcknowledged?: boolean;
      correlationId?: string;
    } = {}
  ): void {
    auditLogger.logMetadataChange({
      videoId,
      userId: options.userId,
      action: 'apply_metadata',
      oldValues: oldMetadata,
      newValues: newMetadata,
      suggestionId: options.suggestionId,
      guardrailsAcknowledged: options.guardrailsAcknowledged,
      correlationId: options.correlationId
    });

    logger.info(`Metadata applied to video ${videoId}`, 'metadata', {
      videoId,
      suggestionId: options.suggestionId,
      guardrailsAcknowledged: options.guardrailsAcknowledged,
      changedFields: {
        title: newMetadata.title !== oldMetadata.title,
        description: newMetadata.description !== oldMetadata.description,
        tags: JSON.stringify(newMetadata.tags) !== JSON.stringify(oldMetadata.tags),
        privacyStatus: newMetadata.privacyStatus !== oldMetadata.privacyStatus
      },
      userId: options.userId,
      correlationId: options.correlationId
    });
  }

  /**
   * Log when a suggestion is rejected
   */
  logSuggestionRejection(
    videoId: string,
    suggestionId: string,
    reason?: string,
    options: { userId?: string; correlationId?: string } = {}
  ): void {
    auditLogger.logMetadataChange({
      videoId,
      userId: options.userId,
      action: 'reject_suggestion',
      suggestionId,
      correlationId: options.correlationId,
      metadata: { rejectionReason: reason }
    });

    logger.info(`Metadata suggestion rejected for video ${videoId}`, 'metadata', {
      videoId,
      suggestionId,
      rejectionReason: reason,
      userId: options.userId,
      correlationId: options.correlationId
    });
  }

  /**
   * Get metadata change history for a video
   */
  async getMetadataHistory(videoId: string, since?: Date): Promise<any[]> {
    return auditLogger.getVideoMetadataHistory(videoId, since);
  }

  private buildTitle(originalTitle: string, keywords: string[]): string {
    const prefix = keywords.slice(0, 2).map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
    const candidate = `${prefix} | ${originalTitle}`.trim();
    return candidate.slice(0, 90);
  }

  private buildDescription(originalDescription: string, keywords: string[], timestamps: TimestampEntry[]): string {
    const summary = keywords.slice(0, 5).map(word => `- ${word}`).join('\n');
    const timestampBlock = timestamps
      .map(entry => `${entry.time} – ${entry.description}`)
      .join('\n');

    return `${originalDescription.trim()}\n\nKey moments:\n${timestampBlock}\n\nHighlights:\n${summary}`.slice(0, 5000);
  }
}

export const metadataService = new MetadataService();
