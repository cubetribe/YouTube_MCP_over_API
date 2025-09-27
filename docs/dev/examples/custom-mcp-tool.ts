/**
 * Example: Custom MCP Tool Implementation
 *
 * This example demonstrates how to add a new MCP tool to the server
 * that provides analytics and insights for YouTube videos.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { YouTubeClient } from '../../src/youtube/client.js';
import type { MCPToolResult } from '../../src/types/index.js';

/**
 * Schema for the video analytics tool input
 */
export const VideoAnalyticsSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  timeRange: z.enum(['7d', '28d', '90d', '365d']).default('28d'),
  metrics: z.array(
    z.enum(['views', 'engagement', 'retention', 'demographics', 'traffic'])
  ).default(['views', 'engagement']),
  includeComparisons: z.boolean().default(false),
  generateInsights: z.boolean().default(true)
});

export type VideoAnalyticsInput = z.infer<typeof VideoAnalyticsSchema>;

/**
 * Result structure for video analytics
 */
export interface VideoAnalyticsResult {
  videoId: string;
  timeRange: string;
  metrics: {
    views?: ViewsMetrics;
    engagement?: EngagementMetrics;
    retention?: RetentionMetrics;
    demographics?: DemographicsMetrics;
    traffic?: TrafficMetrics;
  };
  insights?: AnalyticsInsight[];
  comparisons?: ComparisonData;
  generatedAt: string;
}

/**
 * Service class for handling video analytics operations
 */
export class VideoAnalyticsService {
  constructor(private youtubeClient: YouTubeClient) {}

  /**
   * Generates comprehensive analytics for a YouTube video.
   *
   * @param input - Analytics request parameters
   * @returns Promise resolving to analytics data and insights
   * @throws {Error} If video not found or analytics unavailable
   *
   * @example
   * ```typescript
   * const analytics = await service.generateAnalytics({
   *   videoId: 'dQw4w9WgXcQ',
   *   timeRange: '28d',
   *   metrics: ['views', 'engagement', 'retention'],
   *   generateInsights: true
   * });
   * ```
   */
  async generateAnalytics(input: VideoAnalyticsInput): Promise<VideoAnalyticsResult> {
    // Validate video exists and user has access
    const video = await this.validateVideoAccess(input.videoId);

    const result: VideoAnalyticsResult = {
      videoId: input.videoId,
      timeRange: input.timeRange,
      metrics: {},
      generatedAt: new Date().toISOString()
    };

    // Collect requested metrics
    for (const metric of input.metrics) {
      switch (metric) {
        case 'views':
          result.metrics.views = await this.getViewsMetrics(input.videoId, input.timeRange);
          break;
        case 'engagement':
          result.metrics.engagement = await this.getEngagementMetrics(input.videoId, input.timeRange);
          break;
        case 'retention':
          result.metrics.retention = await this.getRetentionMetrics(input.videoId, input.timeRange);
          break;
        case 'demographics':
          result.metrics.demographics = await this.getDemographicsMetrics(input.videoId, input.timeRange);
          break;
        case 'traffic':
          result.metrics.traffic = await this.getTrafficMetrics(input.videoId, input.timeRange);
          break;
      }
    }

    // Generate insights if requested
    if (input.generateInsights) {
      result.insights = await this.generateInsights(result.metrics, video);
    }

    // Include comparisons if requested
    if (input.includeComparisons) {
      result.comparisons = await this.generateComparisons(input.videoId, result.metrics);
    }

    return result;
  }

  private async validateVideoAccess(videoId: string): Promise<any> {
    const videos = await this.youtubeClient.getVideoDetails(videoId);
    if (videos.length === 0) {
      throw new Error(`Video ${videoId} not found or not accessible`);
    }
    return videos[0];
  }

  private async getViewsMetrics(videoId: string, timeRange: string): Promise<ViewsMetrics> {
    // In a real implementation, this would call YouTube Analytics API
    // For this example, we'll simulate the data structure
    return {
      totalViews: 125000,
      viewsInPeriod: 45000,
      viewsGrowthRate: 0.15,
      dailyViews: this.generateDailyViewsData(timeRange),
      peakViewingTimes: [
        { hour: 20, views: 5000 },
        { hour: 15, views: 4200 },
        { hour: 12, views: 3800 }
      ]
    };
  }

  private async getEngagementMetrics(videoId: string, timeRange: string): Promise<EngagementMetrics> {
    return {
      likes: 8500,
      dislikes: 120,
      comments: 1200,
      shares: 850,
      engagementRate: 0.085,
      likeToDislikeRatio: 70.8,
      commentSentiment: {
        positive: 0.75,
        neutral: 0.20,
        negative: 0.05
      }
    };
  }

  private async getRetentionMetrics(videoId: string, timeRange: string): Promise<RetentionMetrics> {
    return {
      averageViewDuration: 240, // seconds
      averageViewPercentage: 0.68,
      retentionCurve: this.generateRetentionCurve(),
      dropOffPoints: [
        { timestamp: 45, retentionLoss: 0.15 },
        { timestamp: 180, retentionLoss: 0.25 }
      ]
    };
  }

  private async getDemographicsMetrics(videoId: string, timeRange: string): Promise<DemographicsMetrics> {
    return {
      ageGroups: {
        '13-17': 0.08,
        '18-24': 0.32,
        '25-34': 0.38,
        '35-44': 0.15,
        '45-54': 0.05,
        '55-64': 0.02
      },
      genderDistribution: {
        male: 0.62,
        female: 0.38
      },
      topCountries: [
        { country: 'US', percentage: 0.45 },
        { country: 'GB', percentage: 0.12 },
        { country: 'CA', percentage: 0.08 }
      ]
    };
  }

  private async getTrafficMetrics(videoId: string, timeRange: string): Promise<TrafficMetrics> {
    return {
      trafficSources: {
        youtubeSearch: 0.35,
        browseFeatures: 0.25,
        externalSources: 0.15,
        directTraffic: 0.12,
        notifications: 0.08,
        other: 0.05
      },
      topSearchTerms: [
        { term: 'tutorial javascript', percentage: 0.15 },
        { term: 'web development', percentage: 0.12 },
        { term: 'coding basics', percentage: 0.08 }
      ]
    };
  }

  private async generateInsights(metrics: any, video: any): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    // Generate insights based on metrics
    if (metrics.engagement?.engagementRate > 0.08) {
      insights.push({
        type: 'positive',
        category: 'engagement',
        message: 'Excellent engagement rate! Your content resonates well with viewers.',
        recommendation: 'Continue creating similar content to maintain high engagement.',
        confidence: 0.9
      });
    }

    if (metrics.retention?.averageViewPercentage < 0.5) {
      insights.push({
        type: 'warning',
        category: 'retention',
        message: 'Low retention rate detected in the first minute.',
        recommendation: 'Consider improving your video intro to hook viewers earlier.',
        confidence: 0.8
      });
    }

    if (metrics.demographics?.ageGroups?.['25-34'] > 0.3) {
      insights.push({
        type: 'info',
        category: 'demographics',
        message: 'Strong appeal to 25-34 age group.',
        recommendation: 'Tailor future content to this demographic for better performance.',
        confidence: 0.85
      });
    }

    return insights;
  }

  private async generateComparisons(videoId: string, metrics: any): Promise<ComparisonData> {
    // Compare with channel average, similar videos, etc.
    return {
      channelAverage: {
        viewsGrowthRate: 0.12,
        engagementRate: 0.075,
        retentionRate: 0.62
      },
      similarVideos: {
        averageViews: 95000,
        averageEngagement: 0.068,
        averageRetention: 0.59
      },
      performanceRanking: {
        viewsPercentile: 85,
        engagementPercentile: 92,
        retentionPercentile: 78
      }
    };
  }

  // Helper methods for data generation
  private generateDailyViewsData(timeRange: string): Array<{ date: string; views: number }> {
    const days = parseInt(timeRange);
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        views: Math.floor(Math.random() * 2000) + 1000
      });
    }

    return data;
  }

  private generateRetentionCurve(): Array<{ timestamp: number; retention: number }> {
    const curve = [];
    for (let i = 0; i <= 300; i += 15) {
      const retention = Math.max(0.1, 1 - (i / 400) - Math.random() * 0.1);
      curve.push({ timestamp: i, retention });
    }
    return curve;
  }
}

/**
 * Tool registration for the MCP server
 */
export const VIDEO_ANALYTICS_TOOL = {
  name: 'video_analytics',
  description: 'Generate comprehensive analytics and insights for YouTube videos including views, engagement, retention, demographics, and traffic sources.',
  inputSchema: zodToJsonSchema(VideoAnalyticsSchema)
};

/**
 * Tool handler function for the MCP server
 */
export async function handleVideoAnalytics(
  input: VideoAnalyticsInput,
  youtubeClient: YouTubeClient
): Promise<MCPToolResult> {
  try {
    const service = new VideoAnalyticsService(youtubeClient);
    const analytics = await service.generateAnalytics(input);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          analytics,
          summary: {
            videoId: analytics.videoId,
            timeRange: analytics.timeRange,
            metricsCount: Object.keys(analytics.metrics).length,
            insightsCount: analytics.insights?.length || 0,
            hasComparisons: !!analytics.comparisons
          }
        }, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          videoId: input.videoId
        }, null, 2)
      }]
    };
  }
}

// Type definitions
interface ViewsMetrics {
  totalViews: number;
  viewsInPeriod: number;
  viewsGrowthRate: number;
  dailyViews: Array<{ date: string; views: number }>;
  peakViewingTimes: Array<{ hour: number; views: number }>;
}

interface EngagementMetrics {
  likes: number;
  dislikes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  likeToDislikeRatio: number;
  commentSentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

interface RetentionMetrics {
  averageViewDuration: number;
  averageViewPercentage: number;
  retentionCurve: Array<{ timestamp: number; retention: number }>;
  dropOffPoints: Array<{ timestamp: number; retentionLoss: number }>;
}

interface DemographicsMetrics {
  ageGroups: Record<string, number>;
  genderDistribution: {
    male: number;
    female: number;
  };
  topCountries: Array<{ country: string; percentage: number }>;
}

interface TrafficMetrics {
  trafficSources: Record<string, number>;
  topSearchTerms: Array<{ term: string; percentage: number }>;
}

interface AnalyticsInsight {
  type: 'positive' | 'warning' | 'info';
  category: string;
  message: string;
  recommendation: string;
  confidence: number;
}

interface ComparisonData {
  channelAverage: {
    viewsGrowthRate: number;
    engagementRate: number;
    retentionRate: number;
  };
  similarVideos: {
    averageViews: number;
    averageEngagement: number;
    averageRetention: number;
  };
  performanceRanking: {
    viewsPercentile: number;
    engagementPercentile: number;
    retentionPercentile: number;
  };
}