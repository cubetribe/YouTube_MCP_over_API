#!/usr/bin/env node

import path from 'path';
import process from 'process';
import { google } from 'googleapis';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  StartOAuthFlowSchema,
  CompleteOAuthFlowSchema,
  ListVideosSchema,
  GetVideoTranscriptSchema,
  GenerateMetadataSuggestionsSchema,
  ApplyMetadataSchema,
  ScheduleVideosSchema,
  CreatePlaylistSchema,
  AddVideosToPlaylistSchema,
  OrganizePlaylistsSchema,
  BackupVideoMetadataSchema,
  RestoreVideoMetadataSchema,
  GetBatchStatusSchema,
  GenerateThumbnailConceptsSchema,
  GetConfigurationStatusSchema,
  ReloadConfigurationSchema,
  MCPError,
  AuthenticationError,
  type ApplyMetadataInput,
  type MetadataSuggestionRecord,
  type YouTubeVideo,
} from './types/index.js';

import { oauthService } from './auth/oauth-service.js';
import { tokenStorage } from './auth/token-storage.js';
import { YouTubeClient } from './youtube/client.js';
import { TranscriptManager } from './transcript/transcript-manager.js';
import { metadataService } from './metadata/metadata-service.js';
import { metadataReviewStore } from './metadata/metadata-review-store.js';
import { VideoScheduler } from './scheduler/scheduler.js';
import { PlaylistService } from './playlist/playlist-service.js';
import { backupService } from './backup/backup-service.js';
import { batchManager } from './batch/batch-manager.js';
import { BatchOrchestrator, type BatchExecutionItem } from './batch/batch-orchestrator.js';
import { thumbnailConceptService } from './thumbnail/thumbnail-concept-service.js';
import { getConfig, getFeatureFlags, ConfigValidator, formatValidationResults, configManager } from './config/index.js';
// Logger disabled - MCP servers must not write to stdout

// Initialize configuration and create server with config values
const config = getConfig();
const server = new Server(
  {
    name: config.mcpServer.name,
    version: config.mcpServer.version
  },
  {
    capabilities: config.mcpServer.capabilities,
  }
);

const GLOBAL_SUBSCRIPTION_KEY = '__global__';
const resourceSubscriptions = new Map<string, Set<string>>();
const batchOrchestrator = new BatchOrchestrator();

const TOOLS = [
  {
    name: 'start_oauth_flow',
    description: 'Generiert einen OAuth-Link zur Anmeldung bei Google und liefert PKCE-Verifier.',
    inputSchema: zodToJsonSchema(StartOAuthFlowSchema),
  },
  {
    name: 'complete_oauth_flow',
    description: 'Schliesst den OAuth-Prozess mit Code & State ab und speichert Tokens.',
    inputSchema: zodToJsonSchema(CompleteOAuthFlowSchema),
  },
  {
    name: 'list_videos',
    description: 'Listet Videos des authentifizierten Kanals mit Metadaten.',
    inputSchema: zodToJsonSchema(ListVideosSchema),
  },
  {
    name: 'get_video_transcript',
    description: 'Lädt das YouTube-Transkript (falls verfügbar).',
    inputSchema: zodToJsonSchema(GetVideoTranscriptSchema),
  },
  {
    name: 'generate_metadata_suggestions',
    description: 'Erzeugt Metadaten-Vorschläge basierend auf Beschreibung/Transkript.',
    inputSchema: zodToJsonSchema(GenerateMetadataSuggestionsSchema),
  },
  {
    name: 'apply_metadata',
    description: 'Wendet Metadaten auf ein Video an und erstellt optional ein Backup.',
    inputSchema: zodToJsonSchema(ApplyMetadataSchema),
  },
  {
    name: 'schedule_videos',
    description: 'Erstellt einen Veröffentlichungsplan und kann ihn optional anwenden.',
    inputSchema: zodToJsonSchema(ScheduleVideosSchema),
  },
  {
    name: 'create_playlist',
    description: 'Legt eine neue Playlist an.',
    inputSchema: zodToJsonSchema(CreatePlaylistSchema),
  },
  {
    name: 'add_videos_to_playlist',
    description: 'Fügt Videos zu einer bestehenden Playlist hinzu.',
    inputSchema: zodToJsonSchema(AddVideosToPlaylistSchema),
  },
  {
    name: 'organize_playlists',
    description: 'Organisiert Videos automatisch in Playlists (manuell oder nach Kategorie).',
    inputSchema: zodToJsonSchema(OrganizePlaylistsSchema),
  },
  {
    name: 'backup_video_metadata',
    description: 'Erstellt JSON-Backups der Videometadaten.',
    inputSchema: zodToJsonSchema(BackupVideoMetadataSchema),
  },
  {
    name: 'restore_video_metadata',
    description: 'Stellt Metadaten aus einem Backup wieder her.',
    inputSchema: zodToJsonSchema(RestoreVideoMetadataSchema),
  },
  {
    name: 'get_batch_status',
    description: 'Liest den Fortschritt eines Batch-Prozesses aus.',
    inputSchema: zodToJsonSchema(GetBatchStatusSchema),
  },
  {
    name: 'generate_thumbnail_concepts',
    description: 'Generiert Thumbnail-Konzeptvorschläge basierend auf Video-Inhalten und Transkript.',
    inputSchema: zodToJsonSchema(GenerateThumbnailConceptsSchema),
  },
  {
    name: 'get_configuration_status',
    description: 'Zeigt den aktuellen Konfigurationsstatus mit Validierung und Feature-Flags.',
    inputSchema: zodToJsonSchema(GetConfigurationStatusSchema),
  },
  {
    name: 'reload_configuration',
    description: 'Lädt die Konfiguration neu und validiert sie.',
    inputSchema: zodToJsonSchema(ReloadConfigurationSchema),
  },
];

const RESOURCES = [
  { uri: 'youtube://videos', name: 'YouTube Videos', description: 'Aktuelle Videoliste', mimeType: 'application/json' },
  { uri: 'youtube://channels/mine', name: 'Eigener Kanal', description: 'Kanalinformationen', mimeType: 'application/json' },
  { uri: 'youtube://playlists', name: 'Playlists', description: 'Playlists des Kanals', mimeType: 'application/json' },
  { uri: 'backups://list', name: 'Backups', description: 'Verfügbare Metadaten-Backups', mimeType: 'application/json' },
  { uri: 'batch://status/{batchId}', name: 'Batch Status', description: 'Status eines Batch-Vorgangs', mimeType: 'application/json' },
  { uri: 'config://status', name: 'Configuration Status', description: 'Aktueller Konfigurationsstatus und Validierung', mimeType: 'application/json' },
  { uri: 'config://features', name: 'Feature Flags', description: 'Status aller Feature-Flags', mimeType: 'application/json' },
];

function resolveSessionKey(extra: any): string {
  return (
    extra?.sessionId ||
    extra?.requestInfo?.headers?.['mcp-session-id'] ||
    GLOBAL_SUBSCRIPTION_KEY
  );
}

function addSubscription(uri: string, sessionKey: string): void {
  const set = resourceSubscriptions.get(uri) ?? new Set<string>();
  set.add(sessionKey);
  resourceSubscriptions.set(uri, set);
}

function removeSubscription(uri: string, sessionKey: string): void {
  const set = resourceSubscriptions.get(uri);
  if (!set) return;
  set.delete(sessionKey);
  if (set.size === 0) {
    resourceSubscriptions.delete(uri);
  }
}

function hasSubscribers(uri: string): boolean {
  const set = resourceSubscriptions.get(uri);
  return Boolean(set && set.size > 0);
}

function notifyResourceSubscribers(uri: string): void {
  if (!hasSubscribers(uri)) return;
  void server
    .sendResourceUpdated({ uri })
    .catch(() => {
      // Silent catch - MCP servers must not log to stdout/stderr
      // Error is non-critical for resource updates
    });
}

batchOrchestrator.setUpdateListener((batch) => {
  notifyResourceSubscribers(`batch://status/${batch.id}`);
});

interface PlaylistGroupPlan {
  key: string;
  playlistId?: string;
  title?: string;
  description?: string;
  privacyStatus?: 'private' | 'unlisted' | 'public';
  videoIds: string[];
}

interface PlaylistGroupingResult {
  groups: PlaylistGroupPlan[];
  unassigned: string[];
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

async function buildPlaylistGroups(
  input: ReturnType<typeof OrganizePlaylistsSchema.parse>,
  client: YouTubeClient
): Promise<PlaylistGroupingResult> {
  if (input.strategy === 'manual') {
    if (!input.groups || input.groups.length === 0) {
      throw new MCPError('Für die manuelle Strategie müssen Gruppen angegeben werden.', 'INVALID_PARAMS');
    }
    const seen = new Set<string>();
    const groups: PlaylistGroupPlan[] = [];
    input.groups.forEach((group, index) => {
      const provided = dedupe(group.videoIds ?? []);
      if (provided.length === 0) {
        throw new MCPError(`Manual group ${index + 1} enthält keine videoIds.`, 'INVALID_PARAMS');
      }
      provided.forEach((id) => seen.add(id));
      groups.push({
        key: group.playlistId ?? group.playlistTitle ?? `manual_${index}`,
        playlistId: group.playlistId,
        title: group.playlistTitle,
        description: group.description,
        privacyStatus: group.privacyStatus,
        videoIds: provided,
      });
    });
    const unassigned = input.videoIds.filter((id) => !seen.has(id));
    return { groups, unassigned: dedupe(unassigned) };
  }

  const videoDetails = await client.getVideoDetails(input.videoIds);
  const foundIds = new Set<string>();
  const groups = new Map<string, PlaylistGroupPlan>();

  for (const video of videoDetails) {
    const categoryKey = video.categoryId || 'uncategorized';
    const config = input.categoryMap?.[categoryKey];
    const existing = groups.get(categoryKey) ?? {
      key: categoryKey,
      playlistId: config?.playlistId,
      title:
        config?.playlistTitle ||
        (categoryKey === 'uncategorized' ? 'Unsortierte Clips' : `Kategorie ${categoryKey}`),
      description:
        config?.description ||
        (categoryKey === 'uncategorized'
          ? 'Videos ohne spezifische Kategorie'
          : `Videos aus Kategorie ${categoryKey}`),
      privacyStatus: config?.privacyStatus ?? 'private',
      videoIds: [],
    };
    existing.videoIds.push(video.id);
    groups.set(categoryKey, existing);
    foundIds.add(video.id);
  }

  const unassigned = input.videoIds.filter((id) => !foundIds.has(id));
  return {
    groups: Array.from(groups.values()).map((group) => ({
      ...group,
      videoIds: dedupe(group.videoIds),
    })),
    unassigned: dedupe(unassigned),
  };
}

function buildPlaylistBatchItems(params: {
  groups: PlaylistGroupPlan[];
  playlistService: PlaylistService;
  client: YouTubeClient;
  createMissing: boolean;
  startPosition?: number;
}): BatchExecutionItem[] {
  const items: BatchExecutionItem[] = [];
  params.groups.forEach((group, groupIndex) => {
    const state: { playlistId?: string; playlistTitle?: string; playlistUrl?: string } = {
      playlistId: group.playlistId,
      playlistTitle: group.title,
    };

    items.push({
      id: `playlist_${groupIndex}_prepare`,
      label: group.title ?? group.playlistId ?? `Playlist ${groupIndex + 1}`,
      type: 'playlist_prepare',
      playlistId: group.playlistId,
      description: group.playlistId
        ? 'Playlist laden'
        : 'Playlist anlegen (falls nicht vorhanden)',
      run: async () => {
        const playlist = await params.playlistService.findOrCreatePlaylist({
          playlistId: group.playlistId,
          title: group.title,
          description: group.description,
          privacyStatus: group.privacyStatus,
          allowCreate: params.createMissing,
        });
        state.playlistId = playlist.id;
        state.playlistTitle = playlist.title;
        state.playlistUrl = playlist.url;
        return {
          result: playlist,
          context: {
            playlistId: playlist.id,
            playlistTitle: playlist.title,
            playlistUrl: playlist.url,
          },
        };
      },
    });

    group.videoIds.forEach((videoId, videoIndex) => {
      const targetPosition = typeof params.startPosition === 'number'
        ? params.startPosition + videoIndex
        : undefined;
      items.push({
        id: `playlist_${groupIndex}_add_${videoIndex}`,
        label: `Add ${videoId}`,
        type: 'playlist_add_video',
        videoId,
        playlistId: state.playlistId,
        description: targetPosition !== undefined
          ? `Video an Position ${targetPosition} einfügen`
          : 'Video ans Ende der Playlist anhängen',
        run: async () => {
          if (!state.playlistId) {
            const playlist = await params.playlistService.findOrCreatePlaylist({
              playlistId: group.playlistId,
              title: group.title,
              description: group.description,
              privacyStatus: group.privacyStatus,
              allowCreate: params.createMissing,
            });
            state.playlistId = playlist.id;
            state.playlistTitle = playlist.title;
            state.playlistUrl = playlist.url;
          }

          await params.client.addVideoToPlaylist(state.playlistId, videoId, targetPosition);
          return {
            result: {
              playlistId: state.playlistId,
              videoId,
              position: targetPosition,
            },
            context: {
              playlistId: state.playlistId,
              playlistTitle: state.playlistTitle,
              playlistUrl: state.playlistUrl,
            },
          };
        },
      });
    });
  });

  return items;
}

async function getYouTubeClient(): Promise<{ client: YouTubeClient; oauthClient: any }> {
  try {
    const oauthClient = await oauthService.getAuthorizedClient();
    const config = getConfig();

    const client = new YouTubeClient({
      oauthClient,
      quotaLimit: config.youtubeAPI.quotaLimit,
      rateLimiter: {
        maxRequestsPerMinute: config.youtubeAPI.rateLimitRequestsPerMinute,
      },
    });
    return { client, oauthClient };
  } catch (error) {
    throw new AuthenticationError(error instanceof Error ? error.message : String(error));
  }
}

function normalizeTagsInput(value?: string | string[] | null): string[] | undefined {
  if (!value) return undefined;
  const array = Array.isArray(value) ? value : [value];
  const trimmed = array.map(tag => tag.trim()).filter(Boolean);
  return trimmed.length > 0 ? Array.from(new Set(trimmed)) : undefined;
}

function buildMetadataPayload(
  input: ApplyMetadataInput,
  suggestion?: MetadataSuggestionRecord | null
): {
  title?: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: 'private' | 'unlisted' | 'public';
  publishAt?: string;
  defaultLanguage?: string;
} {
  const candidateTitle = suggestion?.suggestions.title?.suggested;
  const candidateDescription = suggestion?.suggestions.description?.suggested;
  const candidateTags = suggestion?.suggestions.tags?.suggested;

  const payload = {
    title: input.title ?? (typeof candidateTitle === 'string' ? candidateTitle : undefined),
    description: input.description ?? (typeof candidateDescription === 'string' ? candidateDescription : undefined),
    tags: input.tags ?? normalizeTagsInput(candidateTags as string | string[] | undefined),
    categoryId: input.categoryId,
    privacyStatus: input.privacyStatus,
  };

  if (!payload.title && !payload.description && !payload.tags && !payload.categoryId && !payload.privacyStatus) {
    throw new MCPError('Keine Metadatenänderung angegeben.', 'EMPTY_METADATA_UPDATE');
  }

  return payload;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: RESOURCES }));

server.setRequestHandler(SubscribeRequestSchema, async (request, extra) => {
  const { uri } = request.params;
  const sessionKey = resolveSessionKey(extra);
  addSubscription(uri, sessionKey);
  return {};
});

server.setRequestHandler(UnsubscribeRequestSchema, async (request, extra) => {
  const { uri } = request.params;
  const sessionKey = resolveSessionKey(extra);
  removeSubscription(uri, sessionKey);
  return {};
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  if (uri === 'youtube://videos') {
    const { client } = await getYouTubeClient();
    const videos = await client.listMyVideos({ maxResults: 25 });
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(videos, null, 2) }],
    };
  }

  if (uri === 'youtube://channels/mine') {
    const { oauthClient } = await getYouTubeClient();
    const youtube = google.youtube({ version: 'v3', auth: oauthClient });
    const response = await youtube.channels.list({ part: ['snippet', 'statistics'], mine: true });
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(response.data.items?.[0] || {}, null, 2) }],
    };
  }

  if (uri === 'youtube://playlists') {
    const { oauthClient } = await getYouTubeClient();
    const youtube = google.youtube({ version: 'v3', auth: oauthClient });
    const response = await youtube.playlists.list({ part: ['snippet', 'contentDetails'], mine: true, maxResults: 50 });
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(response.data.items || [], null, 2) }],
    };
  }

  if (uri === 'backups://list') {
    const backups = await backupService.listBackups();
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(backups, null, 2) }],
    };
  }

  if (uri.startsWith('batch://status/')) {
    const batchId = uri.replace('batch://status/', '');
    const batch = batchManager.get(batchId);
    if (!batch) throw new MCPError(`Batch ${batchId} nicht gefunden`, 'BATCH_NOT_FOUND');
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(batch, null, 2) }],
    };
  }

  if (uri === 'config://status') {
    try {
      const config = getConfig();
      const validation = ConfigValidator.validateAppConfig(config);
      const issuesValidation = ConfigValidator.checkCommonIssues(config);

      const status = {
        isValid: validation.isValid && issuesValidation.isValid,
        environment: config.env,
        timestamp: new Date().toISOString(),
        validation: {
          config: validation,
          issues: issuesValidation,
        },
        summary: {
          oauth: {
            configured: !!(config.oauth.clientId && config.oauth.clientSecret),
            scopes: config.oauth.scopes.length,
            redirectUri: config.oauth.redirectUri,
          },
          storage: {
            backupDir: config.storage.backupDir,
            metadataSuggestionsDir: config.storage.metadataSuggestionsDir,
            tempDir: config.storage.tempDir,
          },
          api: {
            quotaLimit: config.youtubeAPI.quotaLimit,
            rateLimitRPS: config.youtubeAPI.rateLimitRequestsPerSecond,
            rateLimitRPM: config.youtubeAPI.rateLimitRequestsPerMinute,
          },
          logging: {
            level: config.logging.level,
            enableConsole: config.logging.enableConsole,
            enableFile: config.logging.enableFile,
          },
          security: {
            encryptionEnabled: !!config.security.encryptionSecret,
            tokenStorageDir: config.security.tokenStorageDir,
          },
        },
      };

      return {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(status, null, 2) }],
      };
    } catch (error) {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            isValid: false,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          }, null, 2)
        }],
      };
    }
  }

  if (uri === 'config://features') {
    try {
      const featureFlags = getFeatureFlags();
      const allFlags = featureFlags.getAllFlags();
      const summary = featureFlags.getSummary();
      const deprecated = featureFlags.getDeprecatedFlags();

      const status = {
        summary,
        deprecated,
        flags: allFlags,
        enabled: featureFlags.getEnabledFlags(),
        disabled: featureFlags.getDisabledFlags(),
        timestamp: new Date().toISOString(),
      };

      return {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(status, null, 2) }],
      };
    } catch (error) {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          }, null, 2)
        }],
      };
    }
  }

  throw new MCPError(`Resource ${uri} wird nicht unterstützt`, 'RESOURCE_NOT_FOUND');
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'start_oauth_flow': {
        const input = StartOAuthFlowSchema.parse(args);
        const auth = await oauthService.generateAuthorizationUrl(input.scopes);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              authUrl: auth.url,
              state: auth.state,
              message: 'Öffne die URL, bestätige den Zugriff und verwende danach complete_oauth_flow.',
            }, null, 2),
          }],
        };
      }

      case 'complete_oauth_flow': {
        const input = CompleteOAuthFlowSchema.parse(args);
        const tokens = await oauthService.completeAuthorization(input.code, input.state);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, tokens }, null, 2) }],
        };
      }

      case 'list_videos': {
        const input = ListVideosSchema.parse(args);
        const { client } = await getYouTubeClient();
        const videos = await client.listMyVideos(input);
        return {
          content: [{ type: 'text', text: JSON.stringify({ count: videos.length, videos }, null, 2) }],
        };
      }

      case 'get_video_transcript': {
        const input = GetVideoTranscriptSchema.parse(args);
        const { oauthClient } = await getYouTubeClient();
        const manager = new TranscriptManager(oauthClient);
        const result = await manager.getTranscript(input.videoId, input.language);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'generate_metadata_suggestions': {
        const input = GenerateMetadataSuggestionsSchema.parse(args);
        const { client, oauthClient } = await getYouTubeClient();
        const videos = await client.getVideoDetails(input.videoId);
        if (videos.length === 0) throw new MCPError('Video nicht gefunden', 'VIDEO_NOT_FOUND');
        const video = videos[0];
        let transcript: any;
        if (input.includeTranscript) {
          const manager = new TranscriptManager(oauthClient);
          const result = await manager.getTranscript(input.videoId);
          transcript = result.transcript;
        }
        const suggestion = metadataService.generateSuggestion({
          videoId: video.id,
          title: video.title,
          description: video.description,
          tags: video.tags,
          transcript,
        });
        const stored = await metadataReviewStore.saveSuggestion(suggestion);
        const payload = {
          suggestionId: stored.id,
          status: stored.status,
          guardrails: stored.guardrails,
          reviewChecklist: stored.reviewChecklist,
          recommendedNextSteps: stored.recommendedNextSteps,
          summary: {
            requiresApproval: stored.requiresApproval,
            overallConfidence: stored.overallConfidence,
            createdAt: stored.generatedAt,
          },
          suggestion: stored,
          applyInstructions:
            'Rufe apply_metadata mit videoId, suggestionId und acknowledgedGuardrails=true auf, nachdem du alle Guardrails geprüft hast.',
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        };
      }

      case 'apply_metadata': {
        const input = ApplyMetadataSchema.parse(args);
        const { client } = await getYouTubeClient();
        let suggestionRecord: MetadataSuggestionRecord | undefined;
        if (input.suggestionId) {
          suggestionRecord = await metadataReviewStore.getSuggestion(input.suggestionId);
          if (!suggestionRecord) throw new MCPError('Vorschlag nicht gefunden', 'SUGGESTION_NOT_FOUND');
          if (suggestionRecord.videoId !== input.videoId) {
            throw new MCPError('Vorschlag gehört zu einem anderen Video', 'SUGGESTION_MISMATCH');
          }
          if (suggestionRecord.requiresApproval && !input.acknowledgedGuardrails) {
            throw new MCPError(
              'Bitte bestätige acknowledgedGuardrails=true, nachdem du die Prüfliste abgearbeitet hast.',
              'GUARDRAILS_NOT_ACKNOWLEDGED',
              {
                reviewChecklist: suggestionRecord.reviewChecklist,
                guardrails: suggestionRecord.guardrails,
              }
            );
          }
          if (input.acknowledgedGuardrails) {
            await metadataReviewStore.acknowledgeGuardrails(suggestionRecord.id);
          }
        }

        if (input.createBackup) {
          const videos = await client.getVideoDetails(input.videoId);
          if (videos.length > 0) {
            await backupService.backupVideo(videos[0]);
          }
        }
        const resolved = buildMetadataPayload(input, suggestionRecord);
        await client.updateVideoMetadata(input.videoId, resolved);
        if (suggestionRecord) {
          await metadataReviewStore.markApplied(suggestionRecord.id);
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                suggestionId: suggestionRecord?.id,
                appliedFields: Object.entries(resolved)
                  .filter(([, value]) => value !== undefined && value !== null)
                  .map(([key]) => key),
              },
              null,
              2
            ),
          }],
        };
      }

      case 'schedule_videos': {
        const input = ScheduleVideosSchema.parse(args);
        const { client } = await getYouTubeClient();
        const videos = await client.getVideoDetails(input.videoIds);
        const scheduler = new VideoScheduler({
          startDate: input.startDate,
          endDate: input.endDate,
          timeSlots: input.timeSlots,
          timezone: input.timezone,
          mode: input.mode,
          spacing: input.spacing,
          overrides: input.overrides,
        });
        const result = scheduler.schedule(videos.map(video => ({
          videoId: video.id,
          title: video.title,
          category: video.categoryId,
        })));

        let batchId: string | undefined;
        if (input.mode === 'apply') {
          const batch = batchOrchestrator.enqueue({
            type: 'schedule_videos',
            metadata: {
              request: {
                startDate: input.startDate,
                endDate: input.endDate,
                timezone: input.timezone,
                mode: input.mode,
              },
              summary: result.summary,
            },
            items: result.scheduled.map((item) => ({
              id: item.videoId,
              label: item.title,
              type: 'schedule_video',
              videoId: item.videoId,
              description: `Veröffentlichung auf ${item.scheduledTime} setzen`,
              run: async () => {
                await client.updateVideoMetadata(item.videoId, {
                  privacyStatus: 'private',
                  publishAt: item.scheduledTime,
                });
                return { result: { publishAt: item.scheduledTime } };
              },
            })),
          });
          batchId = batch.id;
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({ schedule: result, batchId }, null, 2) }],
        };
      }

      case 'create_playlist': {
        const input = CreatePlaylistSchema.parse(args);
        const { client } = await getYouTubeClient();
        const playlistService = new PlaylistService(client);
        const playlist = await playlistService.createPlaylist({
          title: input.title,
          description: input.description,
          privacyStatus: input.privacyStatus,
          defaultLanguage: input.defaultLanguage,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(playlist, null, 2) }],
        };
      }

      case 'add_videos_to_playlist': {
        const input = AddVideosToPlaylistSchema.parse(args);
        const { client } = await getYouTubeClient();
        let position = input.position ?? 0;
        const batch = batchOrchestrator.enqueue({
          type: 'playlist_management',
          metadata: {
            playlistId: input.playlistId,
            count: input.videoIds.length,
          },
          items: input.videoIds.map((videoId) => {
            const currentPosition = position;
            position += 1;
            return {
              id: `${input.playlistId}_${videoId}_${currentPosition}`,
              label: `Add ${videoId}`,
              type: 'playlist_add_video',
              videoId,
              playlistId: input.playlistId,
              description: `Füge Video an Position ${currentPosition} hinzu`,
              run: async () => {
                await client.addVideoToPlaylist(input.playlistId, videoId, currentPosition);
                return { result: { position: currentPosition } };
              },
            };
          }),
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                batchId: batch.id,
                playlistId: input.playlistId,
                videoCount: input.videoIds.length,
              },
              null,
              2
            ),
          }],
        };
      }

      case 'organize_playlists': {
        const input = OrganizePlaylistsSchema.parse(args);
        const { client } = await getYouTubeClient();
        const playlistService = new PlaylistService(client);

        const grouping = await buildPlaylistGroups(input, client);
        if (grouping.groups.length === 0) {
          throw new MCPError('Keine Playlist-Gruppen ermittelt. Prüfe Eingabeparameter.', 'NO_PLAYLIST_GROUPS');
        }

        const items = buildPlaylistBatchItems({
          groups: grouping.groups,
          playlistService,
          client,
          createMissing: input.createMissingPlaylists,
          startPosition: input.position,
        });

        const batch = batchOrchestrator.enqueue({
          type: 'playlist_management',
          metadata: {
            strategy: input.strategy,
            groupCount: grouping.groups.length,
            createMissingPlaylists: input.createMissingPlaylists,
            groups: grouping.groups.map((group) => ({
              key: group.key,
              playlistId: group.playlistId,
              playlistTitle: group.title,
              videoCount: group.videoIds.length,
            })),
            unassigned: grouping.unassigned,
          },
          items,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                batchId: batch.id,
                groups: grouping.groups.map((group) => ({
                  key: group.key,
                  playlistId: group.playlistId,
                  playlistTitle: group.title,
                  videoCount: group.videoIds.length,
                })),
                unassigned: grouping.unassigned,
              },
              null,
              2
            ),
          }],
        };
      }

      case 'backup_video_metadata': {
        const input = BackupVideoMetadataSchema.parse(args);
        const { client } = await getYouTubeClient();
        let videos: YouTubeVideo[] = [];
        if (input.includeAllVideos) {
          videos = await client.listMyVideos({ maxResults: 50 });
        } else if (input.videoIds) {
          videos = await client.getVideoDetails(input.videoIds);
        } else {
          throw new MCPError('Provide videoIds oder includeAllVideos', 'INVALID_PARAMS');
        }
        const backups: string[] = [];
        for (const video of videos) {
          backups.push(await backupService.backupVideo(video));
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, backups }, null, 2) }],
        };
      }

      case 'restore_video_metadata': {
        const input = RestoreVideoMetadataSchema.parse(args);
        const { client } = await getYouTubeClient();
        const backup = await backupService.restoreVideo(input.backupDate, input.videoId);
        await client.updateVideoMetadata(input.videoId, {
          title: backup.title,
          description: backup.description,
          tags: backup.tags,
          categoryId: backup.categoryId,
          privacyStatus: backup.privacyStatus,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      case 'get_batch_status': {
        const input = GetBatchStatusSchema.parse(args);
        const batch = batchManager.get(input.batchId);
        if (!batch) throw new MCPError('Batch nicht gefunden', 'BATCH_NOT_FOUND');
        return {
          content: [{ type: 'text', text: JSON.stringify(batch, null, 2) }],
        };
      }

      case 'generate_thumbnail_concepts': {
        const input = GenerateThumbnailConceptsSchema.parse(args);
        const { client, oauthClient } = await getYouTubeClient();
        const videos = await client.getVideoDetails(input.videoId);
        if (videos.length === 0) throw new MCPError('Video nicht gefunden', 'VIDEO_NOT_FOUND');
        const video = videos[0];

        let transcript: any;
        if (input.includeTranscript) {
          const manager = new TranscriptManager(oauthClient);
          const result = await manager.getTranscript(input.videoId);
          transcript = result.transcript;
        }

        const concepts = thumbnailConceptService.generateConcepts({
          videoId: video.id,
          title: video.title,
          description: video.description,
          tags: video.tags,
          transcript,
          category: video.categoryId,
          duration: video.duration,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(concepts, null, 2) }],
        };
      }

      case 'get_configuration_status': {
        const input = GetConfigurationStatusSchema.parse(args);

        try {
          const config = getConfig();
          let responseData: any = {
            timestamp: new Date().toISOString(),
            environment: config.env,
          };

          // Include validation if requested
          if (input.includeValidation) {
            const configValidation = ConfigValidator.validateAppConfig(config);
            const issuesValidation = ConfigValidator.checkCommonIssues(config);

            responseData.validation = {
              isValid: configValidation.isValid && issuesValidation.isValid,
              config: {
                isValid: configValidation.isValid,
                errors: configValidation.errors.map(e => ({
                  field: e.field,
                  message: e.message,
                  suggestions: e.suggestions,
                })),
                warnings: configValidation.warnings,
                suggestions: configValidation.suggestions,
              },
              issues: {
                isValid: issuesValidation.isValid,
                errors: issuesValidation.errors.map(e => ({
                  field: e.field,
                  message: e.message,
                  suggestions: e.suggestions,
                })),
                warnings: issuesValidation.warnings,
                suggestions: issuesValidation.suggestions,
              },
            };
          }

          // Include environment variables if requested (filtered)
          if (input.includeEnvironment) {
            const env = configManager.getEnv();
            // Only include non-sensitive environment variables
            responseData.environment_info = {
              NODE_ENV: env.NODE_ENV,
              LOG_LEVEL: env.LOG_LEVEL,
              MCP_SERVER_NAME: env.MCP_SERVER_NAME,
              MCP_SERVER_VERSION: env.MCP_SERVER_VERSION,
              // Redact sensitive values
              YOUTUBE_CLIENT_ID: env.YOUTUBE_CLIENT_ID ? '***CONFIGURED***' : undefined,
              YOUTUBE_CLIENT_SECRET: env.YOUTUBE_CLIENT_SECRET ? '***CONFIGURED***' : undefined,
              OAUTH_ENCRYPTION_SECRET: env.OAUTH_ENCRYPTION_SECRET ? '***CONFIGURED***' : undefined,
            };
          }

          // Filter by section if specified
          if (input.section !== 'all') {
            switch (input.section) {
              case 'oauth':
                responseData.oauth = {
                  configured: !!(config.oauth.clientId && config.oauth.clientSecret),
                  scopes: config.oauth.scopes,
                  redirectUri: config.oauth.redirectUri,
                };
                break;
              case 'security':
                responseData.security = {
                  encryptionEnabled: !!config.security.encryptionSecret,
                  tokenStorageDir: config.security.tokenStorageDir,
                };
                break;
              case 'mcpServer':
                responseData.mcpServer = config.mcpServer;
                break;
              case 'youtubeAPI':
                responseData.youtubeAPI = config.youtubeAPI;
                break;
              case 'storage':
                responseData.storage = config.storage;
                break;
              case 'logging':
                responseData.logging = config.logging;
                break;
            }
          } else {
            // Include all sections
            responseData.config = {
              oauth: {
                configured: !!(config.oauth.clientId && config.oauth.clientSecret),
                scopes: config.oauth.scopes.length,
                redirectUri: config.oauth.redirectUri,
              },
              security: {
                encryptionEnabled: !!config.security.encryptionSecret,
                tokenStorageDir: config.security.tokenStorageDir,
              },
              mcpServer: config.mcpServer,
              youtubeAPI: config.youtubeAPI,
              storage: config.storage,
              logging: config.logging,
            };

            // Include feature flags summary
            const featureFlags = getFeatureFlags();
            responseData.features = featureFlags.getSummary();
          }

          return {
            content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
              }, null, 2)
            }],
          };
        }
      }

      case 'reload_configuration': {
        const input = ReloadConfigurationSchema.parse(args);

        try {
          const oldConfig = getConfig();

          // Reload the configuration
          const newConfig = configManager.reload();

          let responseData: any = {
            success: true,
            timestamp: new Date().toISOString(),
            reloadedAt: new Date().toISOString(),
            environment: newConfig.env,
            changes: {
              environmentChanged: oldConfig.env !== newConfig.env,
              mcpServerConfigChanged: JSON.stringify(oldConfig.mcpServer) !== JSON.stringify(newConfig.mcpServer),
              youtubeAPIConfigChanged: JSON.stringify(oldConfig.youtubeAPI) !== JSON.stringify(newConfig.youtubeAPI),
              storageConfigChanged: JSON.stringify(oldConfig.storage) !== JSON.stringify(newConfig.storage),
              loggingConfigChanged: JSON.stringify(oldConfig.logging) !== JSON.stringify(newConfig.logging),
              oauthConfigChanged: JSON.stringify(oldConfig.oauth) !== JSON.stringify(newConfig.oauth),
              securityConfigChanged: JSON.stringify(oldConfig.security) !== JSON.stringify(newConfig.security),
            },
          };

          // Validate after reload if requested
          if (input.validateAfterReload) {
            const configValidation = ConfigValidator.validateAppConfig(newConfig);
            const issuesValidation = ConfigValidator.checkCommonIssues(newConfig);

            responseData.validation = {
              isValid: configValidation.isValid && issuesValidation.isValid,
              config: {
                isValid: configValidation.isValid,
                errors: configValidation.errors.map(e => ({
                  field: e.field,
                  message: e.message,
                  suggestions: e.suggestions,
                })),
                warnings: configValidation.warnings,
                suggestions: configValidation.suggestions,
              },
              issues: {
                isValid: issuesValidation.isValid,
                errors: issuesValidation.errors.map(e => ({
                  field: e.field,
                  message: e.message,
                  suggestions: e.suggestions,
                })),
                warnings: issuesValidation.warnings,
                suggestions: issuesValidation.suggestions,
              },
            };
          }

          // Notify services if requested (placeholder for future implementation)
          if (input.notifyServices) {
            responseData.serviceNotifications = {
              notified: [],
              warnings: ['Service notification not yet implemented'],
            };
          }

          return {
            content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
              }, null, 2)
            }],
          };
        }
      }

      default:
        throw new MCPError(`Tool ${name} ist unbekannt`, 'UNKNOWN_TOOL');
    }
  } catch (error) {
    // DO NOT log to stdout/stderr in MCP servers!
    // logger.error(`Fehler bei Tool ${name}`, error);
    if (error instanceof MCPError) throw error;
    if (error instanceof AuthenticationError) {
      throw new MCPError(error.message, 'AUTH_REQUIRED');
    }
    throw new MCPError(error instanceof Error ? error.message : String(error), 'INTERNAL_ERROR');
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // DO NOT log to stdout/stderr in MCP servers!
  // logger.info('YouTube MCP Server bereit', { cwd: process.cwd() });
}

main().catch(() => {
  // DO NOT log to stdout/stderr in MCP servers!
  // logger.error('Serverstart fehlgeschlagen', error);
  process.exit(1);
});
