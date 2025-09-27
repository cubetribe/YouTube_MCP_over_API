import type { ParsedTranscript } from '../transcript/transcript-manager.js';
import { TimestampFormatter } from '../utils/timestamp-utils.js';

/**
 * Represents a thumbnail concept with headline, visual cues, and CTA suggestions
 */
export interface ThumbnailConcept {
  /** Primary headline text for the thumbnail */
  headline: string;
  /** Secondary or subtitle text (optional) */
  subtitle?: string;
  /** Confidence score for this concept (0-1) */
  confidence: number;
  /** Reasoning behind this concept choice */
  reason: string;
  /** Visual elements that should be highlighted */
  visualCues: VisualCue[];
  /** Call-to-action suggestions */
  ctaSuggestions: CTASuggestion[];
  /** Key timestamp this concept represents */
  keyTimestamp?: {
    time: string;
    seconds: number;
    description: string;
  };
}

/**
 * Visual elements to emphasize in the thumbnail
 */
export interface VisualCue {
  /** Type of visual element */
  type: 'emotion' | 'object' | 'action' | 'text_overlay' | 'background' | 'composition';
  /** Description of the visual element */
  description: string;
  /** Importance level for this visual cue */
  importance: 'high' | 'medium' | 'low';
  /** Suggested positioning or styling */
  suggestion?: string;
}

/**
 * Call-to-action suggestions for thumbnails
 */
export interface CTASuggestion {
  /** Type of CTA */
  type: 'question' | 'urgency' | 'curiosity' | 'benefit' | 'emotional';
  /** The actual CTA text */
  text: string;
  /** Where this CTA should be positioned */
  placement: 'headline' | 'subtitle' | 'overlay' | 'corner';
  /** Effectiveness rating */
  effectiveness: number;
}

/**
 * Source data for generating thumbnail concepts
 */
export interface ThumbnailConceptSource {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  transcript?: ParsedTranscript;
  category?: string;
  duration?: string;
}

/**
 * Complete thumbnail concept generation result
 */
export interface ThumbnailConceptResult {
  videoId: string;
  generatedAt: string;
  /** Multiple concept options ranked by effectiveness */
  concepts: ThumbnailConcept[];
  /** Overall analysis of the video content */
  contentAnalysis: {
    primaryTopics: string[];
    emotionalTone: 'positive' | 'negative' | 'neutral' | 'mixed';
    targetAudience: string;
    keyMoments: Array<{
      time: string;
      seconds: number;
      description: string;
      thumbnailPotential: number;
    }>;
  };
  /** Recommended best concept */
  recommendedConcept: number; // Index in concepts array
  /** Design guidelines specific to this video */
  designGuidelines: string[];
  /** Warnings or considerations */
  warnings: string[];
}

/**
 * Service for generating thumbnail concepts based on video content and transcripts
 */
export class ThumbnailConceptService {
  /**
   * Generate thumbnail concepts for a video
   */
  generateConcepts(source: ThumbnailConceptSource): ThumbnailConceptResult {
    const contentAnalysis = this.analyzeContent(source);
    const keyMoments = this.extractKeyMoments(source);
    const concepts = this.generateConceptVariations(source, contentAnalysis, keyMoments);
    const designGuidelines = this.generateDesignGuidelines(source, contentAnalysis);
    const warnings = this.generateWarnings(source, contentAnalysis);

    // Rank concepts by effectiveness
    const rankedConcepts = concepts.sort((a, b) => b.confidence - a.confidence);
    const recommendedConcept = 0; // Highest ranked

    return {
      videoId: source.videoId,
      generatedAt: new Date().toISOString(),
      concepts: rankedConcepts,
      contentAnalysis: {
        ...contentAnalysis,
        keyMoments: keyMoments.map(moment => ({
          time: TimestampFormatter.toTimestamp(moment.seconds),
          seconds: moment.seconds,
          description: moment.description,
          thumbnailPotential: moment.thumbnailPotential,
        })),
      },
      recommendedConcept,
      designGuidelines,
      warnings,
    };
  }

  /**
   * Analyze video content to understand tone, topics, and audience
   */
  private analyzeContent(source: ThumbnailConceptSource) {
    const allText = `${source.title} ${source.description} ${source.transcript?.segments.map(s => s.text).join(' ') || ''}`;

    const primaryTopics = this.extractTopics(allText, source.tags);
    const emotionalTone = this.detectEmotionalTone(allText);
    const targetAudience = this.inferTargetAudience(source, allText);

    return {
      primaryTopics,
      emotionalTone,
      targetAudience,
    };
  }

  /**
   * Extract key moments from transcript that would make good thumbnail content
   */
  private extractKeyMoments(source: ThumbnailConceptSource) {
    if (!source.transcript?.segments) {
      return [];
    }

    const segments = source.transcript.segments;
    const keyMoments: Array<{
      seconds: number;
      description: string;
      thumbnailPotential: number;
    }> = [];

    // Look for segments with high thumbnail potential
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const text = segment.text.toLowerCase();

      let potential = 0.1; // Base potential

      // Increase potential for emotional words
      const emotionalWords = ['amazing', 'incredible', 'shocking', 'wow', 'unbelievable', 'insane', 'crazy', 'awesome'];
      if (emotionalWords.some(word => text.includes(word))) {
        potential += 0.3;
      }

      // Increase potential for question words
      if (text.includes('what') || text.includes('how') || text.includes('why') || text.includes('?')) {
        potential += 0.2;
      }

      // Increase potential for demonstration words
      const actionWords = ['show', 'demonstrate', 'reveal', 'discover', 'find', 'see', 'look'];
      if (actionWords.some(word => text.includes(word))) {
        potential += 0.2;
      }

      // Increase potential for numbers and statistics
      if (/\d+/.test(text)) {
        potential += 0.15;
      }

      // Skip very short segments
      if (segment.text.trim().length < 20) {
        potential *= 0.5;
      }

      // Prefer segments in the first third of the video
      const videoProgress = segment.start / (segments[segments.length - 1]?.start || 1);
      if (videoProgress < 0.33) {
        potential += 0.1;
      }

      if (potential > 0.4) {
        keyMoments.push({
          seconds: segment.start,
          description: segment.text.trim(),
          thumbnailPotential: Math.min(potential, 1.0),
        });
      }
    }

    // Return top 5 moments, sorted by potential
    return keyMoments
      .sort((a, b) => b.thumbnailPotential - a.thumbnailPotential)
      .slice(0, 5);
  }

  /**
   * Generate multiple concept variations
   */
  private generateConceptVariations(
    source: ThumbnailConceptSource,
    analysis: any,
    keyMoments: any[]
  ): ThumbnailConcept[] {
    const concepts: ThumbnailConcept[] = [];

    // Concept 1: Question-based (high curiosity)
    concepts.push(this.generateQuestionConcept(source, analysis, keyMoments));

    // Concept 2: Benefit-focused (value proposition)
    concepts.push(this.generateBenefitConcept(source, analysis));

    // Concept 3: Emotional hook (engagement-focused)
    concepts.push(this.generateEmotionalConcept(source, analysis, keyMoments));

    // Concept 4: Authority/Expert positioning
    concepts.push(this.generateAuthorityConcept(source, analysis));

    // Concept 5: Urgency/FOMO (if applicable)
    if (this.isUrgencyApplicable(source, analysis)) {
      concepts.push(this.generateUrgencyConcept(source, analysis));
    }

    return concepts.filter(concept => concept.confidence > 0.3);
  }

  private generateQuestionConcept(source: ThumbnailConceptSource, analysis: any, keyMoments: any[]): ThumbnailConcept {
    const questionWords = ['How', 'What', 'Why', 'When', 'Which'];
    const topic = analysis.primaryTopics[0] || 'this';

    const headlines = [
      `How to ${topic}?`,
      `What happens when ${topic}?`,
      `Why does ${topic} work?`,
      `The secret to ${topic}?`,
    ];

    const headline = headlines[Math.floor(Math.random() * headlines.length)];

    return {
      headline,
      confidence: 0.8,
      reason: 'Questions create curiosity and encourage clicks',
      visualCues: [
        {
          type: 'emotion',
          description: 'Curious or questioning facial expression',
          importance: 'high',
          suggestion: 'Use raised eyebrows or thoughtful expression',
        },
        {
          type: 'text_overlay',
          description: 'Question mark or "?" symbol',
          importance: 'medium',
          suggestion: 'Place question mark prominently but not blocking face',
        },
      ],
      ctaSuggestions: [
        {
          type: 'curiosity',
          text: 'Find out inside!',
          placement: 'subtitle',
          effectiveness: 0.7,
        },
        {
          type: 'question',
          text: 'Watch to learn!',
          placement: 'overlay',
          effectiveness: 0.6,
        },
      ],
      keyTimestamp: keyMoments[0],
    };
  }

  private generateBenefitConcept(source: ThumbnailConceptSource, analysis: any): ThumbnailConcept {
    const topic = analysis.primaryTopics[0] || source.title;
    const benefits = ['Save Time', 'Learn Fast', 'Get Results', 'Unlock Secrets', 'Master'];
    const benefit = benefits[Math.floor(Math.random() * benefits.length)];

    return {
      headline: `${benefit}: ${topic}`,
      confidence: 0.7,
      reason: 'Clear value proposition appeals to viewer\'s self-interest',
      visualCues: [
        {
          type: 'action',
          description: 'Person demonstrating or achieving result',
          importance: 'high',
          suggestion: 'Show before/after or transformation',
        },
        {
          type: 'text_overlay',
          description: 'Benefit-focused text with strong typography',
          importance: 'high',
          suggestion: 'Use bold, readable fonts with high contrast',
        },
      ],
      ctaSuggestions: [
        {
          type: 'benefit',
          text: 'Get results now!',
          placement: 'subtitle',
          effectiveness: 0.8,
        },
      ],
    };
  }

  private generateEmotionalConcept(source: ThumbnailConceptSource, analysis: any, keyMoments: any[]): ThumbnailConcept {
    const emotionalWords = {
      positive: ['Amazing', 'Incredible', 'Awesome', 'Mind-blowing'],
      negative: ['Shocking', 'Disturbing', 'Dangerous', 'Warning'],
      neutral: ['Surprising', 'Interesting', 'Unique', 'Different'],
    };

    const words = emotionalWords[analysis.emotionalTone] || emotionalWords.neutral;
    const word = words[Math.floor(Math.random() * words.length)];
    const topic = analysis.primaryTopics[0] || 'discovery';

    return {
      headline: `${word} ${topic}!`,
      confidence: 0.75,
      reason: 'Emotional triggers increase engagement and sharing',
      visualCues: [
        {
          type: 'emotion',
          description: `Strong ${analysis.emotionalTone} facial expression`,
          importance: 'high',
          suggestion: 'Emphasize genuine emotional reaction',
        },
        {
          type: 'composition',
          description: 'Dynamic composition with movement or action',
          importance: 'medium',
          suggestion: 'Use diagonal lines and asymmetrical balance',
        },
      ],
      ctaSuggestions: [
        {
          type: 'emotional',
          text: 'You won\'t believe this!',
          placement: 'headline',
          effectiveness: 0.7,
        },
      ],
      keyTimestamp: keyMoments.find(m => m.thumbnailPotential > 0.6),
    };
  }

  private generateAuthorityConcept(source: ThumbnailConceptSource, analysis: any): ThumbnailConcept {
    const topic = analysis.primaryTopics[0] || 'topic';
    const authorityPhrases = ['Expert Guide', 'Professional Tips', 'Insider Secrets', 'Complete Guide'];
    const phrase = authorityPhrases[Math.floor(Math.random() * authorityPhrases.length)];

    return {
      headline: `${phrase}: ${topic}`,
      confidence: 0.6,
      reason: 'Authority positioning builds trust and credibility',
      visualCues: [
        {
          type: 'composition',
          description: 'Professional, confident posture and setting',
          importance: 'high',
          suggestion: 'Use clean background and professional lighting',
        },
        {
          type: 'text_overlay',
          description: 'Clean, professional typography',
          importance: 'medium',
          suggestion: 'Use serif fonts or clean sans-serif for authority',
        },
      ],
      ctaSuggestions: [
        {
          type: 'benefit',
          text: 'Learn from the pros',
          placement: 'subtitle',
          effectiveness: 0.6,
        },
      ],
    };
  }

  private generateUrgencyConcept(source: ThumbnailConceptSource, analysis: any): ThumbnailConcept {
    const urgencyPhrases = ['Don\'t Miss', 'Last Chance', 'Before It\'s Gone', 'Limited Time'];
    const phrase = urgencyPhrases[Math.floor(Math.random() * urgencyPhrases.length)];
    const topic = analysis.primaryTopics[0] || 'this';

    return {
      headline: `${phrase}: ${topic}`,
      confidence: 0.5,
      reason: 'Urgency creates FOMO and immediate action',
      visualCues: [
        {
          type: 'text_overlay',
          description: 'Bold, attention-grabbing text with urgency indicators',
          importance: 'high',
          suggestion: 'Use red or orange colors for urgency',
        },
        {
          type: 'background',
          description: 'Dynamic background with energy',
          importance: 'medium',
          suggestion: 'Use gradients or motion blur effects',
        },
      ],
      ctaSuggestions: [
        {
          type: 'urgency',
          text: 'Watch now!',
          placement: 'overlay',
          effectiveness: 0.8,
        },
      ],
    };
  }

  private extractTopics(text: string, tags: string[]): string[] {
    // Combine explicit tags with extracted keywords
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const wordCounts = new Map<string, number>();
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const extractedTopics = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    // Prioritize tags, then add extracted topics
    return [...tags.slice(0, 3), ...extractedTopics].slice(0, 5);
  }

  private detectEmotionalTone(text: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
    const positiveWords = ['amazing', 'awesome', 'great', 'excellent', 'fantastic', 'love', 'best', 'perfect'];
    const negativeWords = ['terrible', 'awful', 'bad', 'worst', 'hate', 'problem', 'issue', 'warning'];

    const words = text.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;

    if (positiveCount > negativeCount * 2) return 'positive';
    if (negativeCount > positiveCount * 2) return 'negative';
    if (positiveCount > 0 && negativeCount > 0) return 'mixed';
    return 'neutral';
  }

  private inferTargetAudience(source: ThumbnailConceptSource, text: string): string {
    const audienceIndicators = {
      beginner: ['beginner', 'start', 'first time', 'intro', 'basics', 'learn'],
      advanced: ['advanced', 'expert', 'professional', 'master', 'complex'],
      general: ['everyone', 'anyone', 'all', 'universal'],
    };

    const textLower = text.toLowerCase();

    for (const [audience, indicators] of Object.entries(audienceIndicators)) {
      if (indicators.some(indicator => textLower.includes(indicator))) {
        return audience;
      }
    }

    return 'general';
  }

  private isUrgencyApplicable(source: ThumbnailConceptSource, analysis: any): boolean {
    const urgencyKeywords = ['limited', 'deadline', 'expires', 'ending', 'last', 'final', 'closing'];
    const text = `${source.title} ${source.description}`.toLowerCase();
    return urgencyKeywords.some(keyword => text.includes(keyword));
  }

  private generateDesignGuidelines(source: ThumbnailConceptSource, analysis: any): string[] {
    const guidelines = [
      'Use high contrast colors to ensure readability on all devices',
      'Keep text large enough to read on mobile devices (minimum 24px)',
      'Ensure faces are clearly visible and take up significant portion of thumbnail',
      'Use the rule of thirds for composition',
      'Avoid cluttered backgrounds that distract from main subject',
    ];

    // Add specific guidelines based on content analysis
    if (analysis.emotionalTone === 'positive') {
      guidelines.push('Use bright, energetic colors to match the positive tone');
    } else if (analysis.emotionalTone === 'negative') {
      guidelines.push('Use darker colors or warning colors (red/orange) appropriately');
    }

    if (analysis.targetAudience === 'beginner') {
      guidelines.push('Use friendly, approachable visual style with clear, simple text');
    } else if (analysis.targetAudience === 'advanced') {
      guidelines.push('Use professional, sophisticated design with technical credibility');
    }

    return guidelines;
  }

  private generateWarnings(source: ThumbnailConceptSource, analysis: any): string[] {
    const warnings = [];

    if (!source.transcript) {
      warnings.push('No transcript available - concepts based only on title and description');
    }

    if (analysis.primaryTopics.length < 2) {
      warnings.push('Limited topic information - may need manual refinement');
    }

    if (source.title.length > 60) {
      warnings.push('Long video title may not fit well in thumbnail - consider shortening');
    }

    return warnings;
  }
}

export const thumbnailConceptService = new ThumbnailConceptService();