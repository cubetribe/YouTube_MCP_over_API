/**
 * Example: Custom Metadata Provider Implementation
 *
 * This example demonstrates how to create a custom metadata provider
 * that extends the base metadata generation capabilities.
 */

import { MetadataProvider } from '../../src/metadata/providers/base-provider.js';
import type {
  MetadataGenerationInput,
  MetadataSuggestion,
  MetadataGuardrail,
  MetadataSuggestionDetails
} from '../../src/types/index.js';

/**
 * Configuration for the SEO-focused metadata provider
 */
interface SEOProviderConfig {
  targetKeywords?: string[];
  maxTitleLength?: number;
  maxDescriptionLength?: number;
  includeCallToAction?: boolean;
}

/**
 * SEO-focused metadata provider that optimizes content for search engines
 *
 * @example
 * ```typescript
 * const provider = new SEOMetadataProvider({
 *   targetKeywords: ['tutorial', 'javascript', 'beginners'],
 *   maxTitleLength: 60,
 *   includeCallToAction: true
 * });
 *
 * const suggestions = await provider.generateSuggestions({
 *   videoId: 'abc123',
 *   title: 'Basic Tutorial',
 *   description: 'Learn the basics',
 *   tags: ['programming']
 * });
 * ```
 */
export class SEOMetadataProvider extends MetadataProvider {
  name = 'seo-optimizer';
  version = '1.0.0';

  constructor(private config: SEOProviderConfig = {}) {
    super();
  }

  async generateSuggestions(input: MetadataGenerationInput): Promise<MetadataSuggestion> {
    // Analyze content for SEO opportunities
    const analysis = await this.analyzeSEOPotential(input);

    // Generate optimized title
    const titleSuggestion = this.generateSEOTitle(input, analysis);

    // Generate optimized description
    const descriptionSuggestion = this.generateSEODescription(input, analysis);

    // Generate optimized tags
    const tagsSuggestion = this.generateSEOTags(input, analysis);

    return {
      videoId: input.videoId,
      generatedAt: new Date().toISOString(),
      originalTitle: input.title,
      originalDescription: input.description,
      originalTags: input.tags,
      suggestions: {
        title: titleSuggestion,
        description: descriptionSuggestion,
        tags: tagsSuggestion
      },
      overallConfidence: this.calculateConfidence([
        titleSuggestion.confidence,
        descriptionSuggestion.confidence,
        tagsSuggestion.confidence
      ]),
      requiresApproval: true,
      guardrails: this.validateSuggestions(input),
      reviewChecklist: this.generateSEOChecklist(),
      recommendedNextSteps: this.generateSEONextSteps()
    };
  }

  validateSuggestions(input: MetadataGenerationInput): MetadataGuardrail[] {
    const guardrails: MetadataGuardrail[] = [];

    // Check for keyword stuffing
    const keywordDensity = this.calculateKeywordDensity(input.description);
    if (keywordDensity > 0.03) { // 3% threshold
      guardrails.push({
        type: 'content_policy',
        status: 'warning',
        message: 'High keyword density detected - may appear as spam to search engines'
      });
    }

    // Check title length for SEO
    if (input.title.length > 60) {
      guardrails.push({
        type: 'length_limits',
        status: 'warning',
        message: 'Title may be truncated in search results (>60 characters)'
      });
    }

    // Check description length
    if (input.description.length > 160) {
      guardrails.push({
        type: 'length_limits',
        status: 'warning',
        message: 'Description may be truncated in search snippets (>160 characters)'
      });
    }

    return guardrails;
  }

  private async analyzeSEOPotential(input: MetadataGenerationInput): Promise<SEOAnalysis> {
    return {
      topKeywords: this.extractKeywords(input.description + ' ' + input.title),
      competitiveKeywords: this.config.targetKeywords || [],
      sentimentScore: this.analyzeSentiment(input.description),
      readabilityScore: this.calculateReadability(input.description),
      contentType: this.detectContentType(input.title, input.description)
    };
  }

  private generateSEOTitle(
    input: MetadataGenerationInput,
    analysis: SEOAnalysis
  ): MetadataSuggestionDetails {
    const maxLength = this.config.maxTitleLength || 60;
    const keywords = analysis.topKeywords.slice(0, 2);

    let optimizedTitle = this.incorporateKeywords(input.title, keywords);

    // Ensure title is under max length
    if (optimizedTitle.length > maxLength) {
      optimizedTitle = this.truncateTitle(optimizedTitle, maxLength);
    }

    return this.formatSuggestion(
      'title',
      optimizedTitle,
      `Optimized for SEO with keywords: ${keywords.join(', ')}`,
      0.85
    );
  }

  private generateSEODescription(
    input: MetadataGenerationInput,
    analysis: SEOAnalysis
  ): MetadataSuggestionDetails {
    let description = input.description;

    // Add call-to-action if enabled
    if (this.config.includeCallToAction) {
      const cta = this.generateCallToAction(analysis.contentType);
      description = this.incorporateCallToAction(description, cta);
    }

    // Optimize with keywords
    description = this.incorporateKeywords(description, analysis.competitiveKeywords);

    return this.formatSuggestion(
      'description',
      description,
      'Optimized for search engines with strategic keyword placement and call-to-action',
      0.80
    );
  }

  private generateSEOTags(
    input: MetadataGenerationInput,
    analysis: SEOAnalysis
  ): MetadataSuggestionDetails {
    const existingTags = new Set(input.tags.map(tag => tag.toLowerCase()));
    const newTags = [...input.tags];

    // Add competitive keywords as tags
    for (const keyword of analysis.competitiveKeywords) {
      if (!existingTags.has(keyword.toLowerCase())) {
        newTags.push(keyword);
        existingTags.add(keyword.toLowerCase());
      }
    }

    // Add content-type specific tags
    const contentTypeTags = this.getContentTypeTags(analysis.contentType);
    for (const tag of contentTypeTags) {
      if (!existingTags.has(tag.toLowerCase()) && newTags.length < 15) {
        newTags.push(tag);
        existingTags.add(tag.toLowerCase());
      }
    }

    return this.formatSuggestion(
      'tags',
      newTags,
      'Enhanced with SEO-optimized keywords and content-type tags',
      0.75
    );
  }

  // Helper methods
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction (in production, use NLP library)
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const frequency = new Map<string, number>();
    words.forEach(word => {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    });

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private calculateKeywordDensity(text: string): number {
    if (!this.config.targetKeywords?.length) return 0;

    const words = text.toLowerCase().split(/\s+/);
    const keywordCount = words.filter(word =>
      this.config.targetKeywords!.some(keyword =>
        keyword.toLowerCase().includes(word) || word.includes(keyword.toLowerCase())
      )
    ).length;

    return keywordCount / words.length;
  }

  private incorporateKeywords(text: string, keywords: string[]): string {
    let result = text;

    // Simple keyword incorporation (in production, use more sophisticated NLP)
    keywords.forEach((keyword, index) => {
      if (!result.toLowerCase().includes(keyword.toLowerCase()) && index < 2) {
        result = `${keyword}: ${result}`;
      }
    });

    return result;
  }

  private generateCallToAction(contentType: string): string {
    const ctas = {
      tutorial: 'Subscribe for more tutorials!',
      review: 'What do you think? Let me know in the comments!',
      entertainment: 'Like and share if you enjoyed this!',
      educational: 'Learn more in the description below!',
      default: 'Don\'t forget to like and subscribe!'
    };

    return ctas[contentType] || ctas.default;
  }

  private calculateConfidence(scores: number[]): number {
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private generateSEOChecklist(): string[] {
    return [
      'Verify keywords appear naturally in title and description',
      'Check that title is under 60 characters for search display',
      'Ensure description includes compelling call-to-action',
      'Confirm tags are relevant and not overly repetitive',
      'Review content for keyword stuffing',
      'Validate that metadata accurately represents video content'
    ];
  }

  private generateSEONextSteps(): string[] {
    return [
      'Monitor search rankings for target keywords',
      'A/B test different title variations',
      'Analyze competitor metadata strategies',
      'Consider creating custom thumbnails with keyword text',
      'Update tags based on trending topics in your niche'
    ];
  }

  // Additional helper methods would go here...
  private analyzeSentiment(text: string): number { return 0.5; }
  private calculateReadability(text: string): number { return 0.7; }
  private detectContentType(title: string, description: string): string { return 'tutorial'; }
  private truncateTitle(title: string, maxLength: number): string {
    return title.length > maxLength ? title.substring(0, maxLength - 3) + '...' : title;
  }
  private incorporateCallToAction(description: string, cta: string): string {
    return `${description}\n\n${cta}`;
  }
  private getContentTypeTags(contentType: string): string[] {
    return ['educational', 'tutorial', 'howto'];
  }
}

// Type definitions
interface SEOAnalysis {
  topKeywords: string[];
  competitiveKeywords: string[];
  sentimentScore: number;
  readabilityScore: number;
  contentType: string;
}