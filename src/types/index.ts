import { z } from 'zod';

/**
 * Shared type definitions and Zod schemas.
 */

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
  thumbnails: Record<string, { url: string; width?: number; height?: number }>;
  publishedAt: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
  duration?: string;
}

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  customUrl?: string;
  thumbnails: Record<string, { url: string; width?: number; height?: number }>;
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
  itemCount: number;
  url: string;
  thumbnails?: Record<string, { url: string; width?: number; height?: number }>;
}

/**
 * Zod schemas for tool inputs.
 */
export const StartOAuthFlowSchema = z.object({
  scopes: z.array(z.string().min(1)).optional(),
  prompt: z.enum(['none', 'consent', 'select_account']).optional(),
  accessType: z.enum(['online', 'offline']).optional().default('offline'),
});

export const CompleteOAuthFlowSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
});

export const ListVideosSchema = z.object({
  maxResults: z.number().int().min(1).max(50).optional().default(25),
  order: z.enum(['date', 'rating', 'relevance', 'title', 'viewCount']).optional(),
  publishedAfter: z.string().optional(),
  publishedBefore: z.string().optional(),
  videoCategoryId: z.string().optional(),
});

export const GetVideoTranscriptSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  language: z.string().optional(),
  format: z.enum(['text', 'json']).optional().default('text'),
});

export const GenerateMetadataSuggestionsSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  includeTranscript: z.boolean().optional().default(true),
  optimizeFor: z.enum(['seo', 'engagement', 'discovery']).optional().default('seo'),
});

export const ApplyMetadataSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  categoryId: z.string().optional(),
  privacyStatus: z.enum(['private', 'unlisted', 'public']).optional(),
  createBackup: z.boolean().optional().default(true),
  suggestionId: z.string().optional(),
  acknowledgedGuardrails: z.boolean().optional().default(false),
});

export const ScheduleVideosSchema = z.object({
  videoIds: z.array(z.string().min(1)).min(1, 'At least one video ID is required'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timeSlots: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional().default(['09:00', '13:00', '18:00']),
  timezone: z.string().optional().default('UTC'),
  mode: z.enum(['preview', 'apply']).optional().default('preview'),
  categories: z.record(z.array(z.string().min(1)).min(1)).optional(),
  overrides: z.record(z.string().min(1)).optional(),
  spacing: z
    .object({
      minHoursBetweenVideos: z.number().min(0).optional(),
      maxVideosPerDay: z.number().min(1).optional(),
    })
    .optional(),
});

export const CreatePlaylistSchema = z.object({
  title: z.string().min(1, 'Playlist title is required').max(150),
  description: z.string().optional(),
  privacyStatus: z.enum(['private', 'unlisted', 'public']).optional().default('private'),
  defaultLanguage: z.string().optional(),
});

export const AddVideosToPlaylistSchema = z.object({
  playlistId: z.string().min(1, 'Playlist ID is required'),
  videoIds: z.array(z.string().min(1)).min(1, 'Provide at least one video ID'),
  position: z.number().int().min(0).optional(),
});

export const OrganizePlaylistsSchema = z.object({
  videoIds: z.array(z.string().min(1)).min(1, 'Provide at least one video ID'),
  strategy: z.enum(['manual', 'category']).optional().default('category'),
  groups: z
    .array(
      z.object({
        playlistId: z.string().optional(),
        playlistTitle: z.string().optional(),
        description: z.string().optional(),
        privacyStatus: z.enum(['private', 'unlisted', 'public']).optional(),
        videoIds: z.array(z.string().min(1)).optional(),
      })
    )
    .optional(),
  categoryMap: z
    .record(
      z.object({
        playlistId: z.string().optional(),
        playlistTitle: z.string().optional(),
        description: z.string().optional(),
        privacyStatus: z.enum(['private', 'unlisted', 'public']).optional(),
      })
    )
    .optional(),
  createMissingPlaylists: z.boolean().optional().default(true),
  position: z.number().int().min(0).optional(),
});

export const BackupVideoMetadataSchema = z.object({
  videoIds: z.array(z.string().min(1)).optional(),
  includeAllVideos: z.boolean().optional().default(false),
});

export const RestoreVideoMetadataSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  backupDate: z.string().min(1, 'Backup date is required'),
  fields: z
    .array(
      z.enum(['title', 'description', 'tags', 'categoryId', 'defaultLanguage', 'privacyStatus'])
    )
    .optional(),
});

export const GetBatchStatusSchema = z.object({
  batchId: z.string().min(1, 'Batch ID is required'),
});

export const GenerateThumbnailConceptsSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  includeTranscript: z.boolean().optional().default(true),
  conceptCount: z.number().int().min(1).max(10).optional().default(5),
  optimizeFor: z.enum(['engagement', 'curiosity', 'authority', 'emotion']).optional().default('engagement'),
});

export const GetConfigurationStatusSchema = z.object({
  includeValidation: z.boolean().optional().default(true),
  includeEnvironment: z.boolean().optional().default(false),
  section: z.enum(['oauth', 'security', 'mcpServer', 'youtubeAPI', 'storage', 'logging', 'all']).optional().default('all'),
});

export const ReloadConfigurationSchema = z.object({
  validateAfterReload: z.boolean().optional().default(true),
  notifyServices: z.boolean().optional().default(false),
});

/**
 * Metadata suggestion structures.
 */
export interface TimestampEntry {
  time: string;
  seconds: number;
  description: string;
  importance: 'high' | 'medium' | 'low';
}

export interface MetadataSuggestionDetails {
  suggested: string | string[];
  reason: string;
  confidence: number;
  improvements?: string[];
}

export type GuardrailType =
  | 'content_policy'
  | 'brand_safety'
  | 'accuracy'
  | 'length_limits'
  | 'manual_review';

export interface MetadataGuardrail {
  type: GuardrailType;
  status: 'pass' | 'warning' | 'fail';
  message: string;
}

export interface MetadataSuggestion {
  videoId: string;
  generatedAt: string;
  originalTitle: string;
  originalDescription: string;
  originalTags: string[];
  suggestions: {
    title?: MetadataSuggestionDetails;
    description?: MetadataSuggestionDetails & { timestamps?: TimestampEntry[] };
    tags?: MetadataSuggestionDetails;
  };
  overallConfidence: number;
  requiresApproval: boolean;
  guardrails: MetadataGuardrail[];
  reviewChecklist: string[];
  recommendedNextSteps: string[];
}

export interface MetadataSuggestionRecord extends MetadataSuggestion {
  id: string;
  status: 'pending' | 'applied' | 'superseded';
  updatedAt: string;
  acknowledgedAt?: string;
  appliedAt?: string;
}

export interface BatchOperation {
  id: string;
  type: 'metadata_update' | 'schedule_videos' | 'playlist_management';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: {
    total: number;
    completed: number;
    failed: number;
    current?: string;
  };
  operations: BatchOperationItem[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface BatchOperationItem {
  id: string;
  type: string;
  videoId?: string;
  playlistId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  label?: string;
  description?: string;
  startedAt?: string;
  completedAt?: string;
  context?: Record<string, unknown>;
  result?: any;
  error?: string;
}

export class MCPError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'MCPError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export type MCPToolInput =
  | z.infer<typeof StartOAuthFlowSchema>
  | z.infer<typeof CompleteOAuthFlowSchema>
  | z.infer<typeof ListVideosSchema>
  | z.infer<typeof GetVideoTranscriptSchema>
  | z.infer<typeof GenerateMetadataSuggestionsSchema>
  | z.infer<typeof ApplyMetadataSchema>
  | z.infer<typeof ScheduleVideosSchema>
  | z.infer<typeof CreatePlaylistSchema>
  | z.infer<typeof AddVideosToPlaylistSchema>
  | z.infer<typeof OrganizePlaylistsSchema>
  | z.infer<typeof BackupVideoMetadataSchema>
  | z.infer<typeof RestoreVideoMetadataSchema>
  | z.infer<typeof GetBatchStatusSchema>
  | z.infer<typeof GenerateThumbnailConceptsSchema>
  | z.infer<typeof GetConfigurationStatusSchema>
  | z.infer<typeof ReloadConfigurationSchema>;

export type ApplyMetadataInput = z.infer<typeof ApplyMetadataSchema>;
