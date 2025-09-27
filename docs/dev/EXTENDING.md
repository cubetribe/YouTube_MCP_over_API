# Extension Guide

## Overview

YouTube MCP Extended is designed to be extensible and modular. This guide covers how to add new functionality, create custom modules, and extend existing services.

## Adding New MCP Tools

### Tool Implementation Pattern

1. **Define Tool Schema**:
   ```typescript
   // src/types/index.ts
   export const NewToolSchema = z.object({
     videoId: z.string().min(1, 'Video ID is required'),
     customParam: z.string().optional(),
     options: z.object({
       flag: z.boolean().default(false)
     }).optional()
   });

   // Add to tool input union type
   export type MCPToolInput =
     | z.infer<typeof ExistingToolSchema>
     | z.infer<typeof NewToolSchema>; // Add this line
   ```

2. **Register Tool in Server**:
   ```typescript
   // src/index.ts
   const TOOLS = [
     // ... existing tools
     {
       name: 'new_tool_name',
       description: 'Description of what the tool does',
       inputSchema: zodToJsonSchema(NewToolSchema),
     }
   ];
   ```

3. **Implement Tool Handler**:
   ```typescript
   // src/index.ts - in CallToolRequestSchema handler
   switch (name) {
     // ... existing cases
     case 'new_tool_name': {
       const input = NewToolSchema.parse(args);

       // Implement tool logic
       const result = await handleNewTool(input);

       return {
         content: [{
           type: 'text',
           text: JSON.stringify(result, null, 2)
         }]
       };
     }
   }
   ```

### Tool Implementation Best Practices

```typescript
// Create a dedicated service for complex tools
// src/new-feature/new-service.ts
export class NewService {
  constructor(
    private youtubeClient: YouTubeClient,
    private config: AppConfig
  ) {}

  async performOperation(input: NewToolInput): Promise<NewToolResult> {
    // Validate business logic
    await this.validateInput(input);

    // Perform operation
    const result = await this.executeOperation(input);

    // Post-process and return
    return this.formatResult(result);
  }

  private async validateInput(input: NewToolInput): Promise<void> {
    // Custom validation beyond schema
    if (input.customParam && !this.isValidCustomParam(input.customParam)) {
      throw new MCPError('Invalid custom parameter', 'INVALID_CUSTOM_PARAM');
    }
  }

  private async executeOperation(input: NewToolInput): Promise<RawResult> {
    // Main operation logic
    try {
      return await this.youtubeClient.performAction(input);
    } catch (error) {
      throw new MCPError(
        `Operation failed: ${error.message}`,
        'OPERATION_FAILED',
        { originalError: error }
      );
    }
  }

  private formatResult(rawResult: RawResult): NewToolResult {
    // Format for MCP response
    return {
      success: true,
      data: rawResult,
      metadata: {
        processedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }
}
```

## Creating New Service Modules

### Service Module Structure

```typescript
// src/new-service/index.ts
export { NewService } from './service.js';
export * from './types.js';

// src/new-service/types.ts
export interface NewServiceConfig {
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface NewServiceInput {
  id: string;
  params: Record<string, unknown>;
}

export interface NewServiceResult {
  success: boolean;
  data: unknown;
  metadata?: Record<string, unknown>;
}

// src/new-service/service.ts
import type { YouTubeClient } from '../youtube/client.js';
import type {
  NewServiceConfig,
  NewServiceInput,
  NewServiceResult
} from './types.js';

export class NewService {
  constructor(
    private config: NewServiceConfig,
    private youtubeClient: YouTubeClient
  ) {
    this.validateConfig();
  }

  async process(input: NewServiceInput): Promise<NewServiceResult> {
    // Implementation
  }

  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('API key is required for NewService');
    }
  }
}
```

### Service Integration

```typescript
// src/index.ts - integrate new service
import { NewService } from './new-service/index.js';

// Initialize service
const newService = new NewService(
  config.newService, // Add to config schema
  client
);

// Use in tool handler
case 'use_new_service': {
  const input = UseNewServiceSchema.parse(args);
  const result = await newService.process(input);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }]
  };
}
```

## Custom Metadata Providers

### Metadata Provider Interface

```typescript
// src/metadata/providers/base-provider.ts
export abstract class MetadataProvider {
  abstract name: string;
  abstract version: string;

  abstract generateSuggestions(
    input: MetadataGenerationInput
  ): Promise<MetadataSuggestion>;

  abstract validateSuggestions(
    suggestions: MetadataSuggestion
  ): MetadataGuardrail[];

  protected formatSuggestion(
    field: string,
    suggested: string | string[],
    reason: string,
    confidence: number
  ): MetadataSuggestionDetails {
    return {
      suggested,
      reason,
      confidence,
      improvements: []
    };
  }
}
```

### Custom Provider Implementation

```typescript
// src/metadata/providers/custom-provider.ts
export class CustomMetadataProvider extends MetadataProvider {
  name = 'custom-provider';
  version = '1.0.0';

  constructor(private config: CustomProviderConfig) {
    super();
  }

  async generateSuggestions(
    input: MetadataGenerationInput
  ): Promise<MetadataSuggestion> {
    const titleSuggestion = await this.generateTitle(input);
    const descriptionSuggestion = await this.generateDescription(input);
    const tagsSuggestion = await this.generateTags(input);

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
      overallConfidence: this.calculateOverallConfidence([
        titleSuggestion.confidence,
        descriptionSuggestion.confidence,
        tagsSuggestion.confidence
      ]),
      requiresApproval: true,
      guardrails: this.validateSuggestions(/* ... */),
      reviewChecklist: this.generateReviewChecklist(),
      recommendedNextSteps: this.generateNextSteps()
    };
  }

  private async generateTitle(
    input: MetadataGenerationInput
  ): Promise<MetadataSuggestionDetails> {
    // Custom title generation logic
    const analyzed = await this.analyzeContent(input);
    const optimizedTitle = this.optimizeTitle(analyzed);

    return this.formatSuggestion(
      'title',
      optimizedTitle,
      'Generated based on content analysis and engagement patterns',
      0.85
    );
  }

  private async analyzeContent(input: MetadataGenerationInput): Promise<ContentAnalysis> {
    // Custom content analysis
    return {
      topics: this.extractTopics(input.description),
      sentiment: this.analyzeSentiment(input.description),
      keywords: this.extractKeywords(input.transcript),
      category: this.categorizeContent(input)
    };
  }

  validateSuggestions(suggestions: MetadataSuggestion): MetadataGuardrail[] {
    const guardrails: MetadataGuardrail[] = [];

    // Custom validation logic
    if (suggestions.suggestions.title?.suggested) {
      const title = suggestions.suggestions.title.suggested as string;
      if (title.length > 100) {
        guardrails.push({
          type: 'length_limits',
          status: 'fail',
          message: 'Title exceeds 100 character limit'
        });
      }
    }

    return guardrails;
  }
}
```

### Provider Registration

```typescript
// src/metadata/metadata-service.ts
import { CustomMetadataProvider } from './providers/custom-provider.js';

export class MetadataService {
  private providers: Map<string, MetadataProvider> = new Map();

  constructor() {
    this.registerProvider(new DefaultMetadataProvider());
    this.registerProvider(new CustomMetadataProvider(config.customProvider));
  }

  registerProvider(provider: MetadataProvider): void {
    this.providers.set(provider.name, provider);
  }

  async generateSuggestion(
    input: MetadataGenerationInput,
    providerName = 'default'
  ): Promise<MetadataSuggestion> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    return provider.generateSuggestions(input);
  }
}
```

## Custom Backup Strategies

### Backup Strategy Interface

```typescript
// src/backup/strategies/base-strategy.ts
export abstract class BackupStrategy {
  abstract name: string;
  abstract description: string;

  abstract backup(data: BackupData): Promise<BackupResult>;
  abstract restore(backupId: string): Promise<RestoreResult>;
  abstract list(): Promise<BackupEntry[]>;
  abstract delete(backupId: string): Promise<void>;

  protected generateBackupId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Custom Strategy Implementation

```typescript
// src/backup/strategies/cloud-strategy.ts
export class CloudBackupStrategy extends BackupStrategy {
  name = 'cloud-backup';
  description = 'Cloud-based backup storage';

  constructor(private cloudClient: CloudStorageClient) {
    super();
  }

  async backup(data: BackupData): Promise<BackupResult> {
    const backupId = this.generateBackupId();
    const compressed = await this.compressData(data);
    const encrypted = await this.encryptData(compressed);

    await this.cloudClient.upload(backupId, encrypted);

    return {
      id: backupId,
      timestamp: new Date().toISOString(),
      size: encrypted.length,
      checksum: this.calculateChecksum(encrypted),
      location: `cloud://${backupId}`
    };
  }

  async restore(backupId: string): Promise<RestoreResult> {
    const encrypted = await this.cloudClient.download(backupId);
    const compressed = await this.decryptData(encrypted);
    const data = await this.decompressData(compressed);

    return {
      data,
      metadata: {
        backupId,
        restoredAt: new Date().toISOString()
      }
    };
  }

  private async compressData(data: BackupData): Promise<Buffer> {
    // Implement compression
  }

  private async encryptData(data: Buffer): Promise<Buffer> {
    // Implement encryption
  }
}
```

## Custom Playlist Algorithms

### Algorithm Interface

```typescript
// src/playlist/algorithms/base-algorithm.ts
export abstract class PlaylistAlgorithm {
  abstract name: string;
  abstract description: string;

  abstract organize(
    videos: YouTubeVideo[],
    options: AlgorithmOptions
  ): Promise<PlaylistGroupingResult>;

  protected createGroup(
    key: string,
    videos: YouTubeVideo[],
    options?: {
      title?: string;
      description?: string;
      privacyStatus?: 'private' | 'unlisted' | 'public';
    }
  ): PlaylistGroupPlan {
    return {
      key,
      title: options?.title || this.generateTitle(key, videos),
      description: options?.description || this.generateDescription(key, videos),
      privacyStatus: options?.privacyStatus || 'private',
      videoIds: videos.map(v => v.id)
    };
  }

  protected abstract generateTitle(key: string, videos: YouTubeVideo[]): string;
  protected abstract generateDescription(key: string, videos: YouTubeVideo[]): string;
}
```

### Custom Algorithm Implementation

```typescript
// src/playlist/algorithms/topic-algorithm.ts
export class TopicBasedAlgorithm extends PlaylistAlgorithm {
  name = 'topic-based';
  description = 'Groups videos by detected topics using NLP';

  constructor(private nlpService: NLPService) {
    super();
  }

  async organize(
    videos: YouTubeVideo[],
    options: AlgorithmOptions
  ): Promise<PlaylistGroupingResult> {
    const topicGroups = new Map<string, YouTubeVideo[]>();
    const unassigned: YouTubeVideo[] = [];

    for (const video of videos) {
      const topics = await this.extractTopics(video);

      if (topics.length === 0) {
        unassigned.push(video);
        continue;
      }

      const primaryTopic = topics[0]; // Use highest confidence topic
      const group = topicGroups.get(primaryTopic) || [];
      group.push(video);
      topicGroups.set(primaryTopic, group);
    }

    const groups = Array.from(topicGroups.entries()).map(([topic, videos]) =>
      this.createGroup(topic, videos)
    );

    return {
      groups,
      unassigned: unassigned.map(v => v.id)
    };
  }

  private async extractTopics(video: YouTubeVideo): Promise<string[]> {
    const text = `${video.title} ${video.description}`;
    return this.nlpService.extractTopics(text);
  }

  protected generateTitle(topic: string, videos: YouTubeVideo[]): string {
    return `${this.capitalizeFirst(topic)} Videos (${videos.length})`;
  }

  protected generateDescription(topic: string, videos: YouTubeVideo[]): string {
    return `Collection of videos about ${topic}. Contains ${videos.length} videos.`;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
```

### Algorithm Registration

```typescript
// src/playlist/playlist-service.ts
import { TopicBasedAlgorithm } from './algorithms/topic-algorithm.js';

export class PlaylistService {
  private algorithms: Map<string, PlaylistAlgorithm> = new Map();

  constructor(private youtubeClient: YouTubeClient) {
    this.registerAlgorithm(new CategoryBasedAlgorithm());
    this.registerAlgorithm(new TopicBasedAlgorithm(nlpService));
  }

  registerAlgorithm(algorithm: PlaylistAlgorithm): void {
    this.algorithms.set(algorithm.name, algorithm);
  }

  async organizeVideos(
    videoIds: string[],
    strategy: string,
    options: OrganizationOptions
  ): Promise<PlaylistGroupingResult> {
    const algorithm = this.algorithms.get(strategy);
    if (!algorithm) {
      throw new Error(`Unknown playlist algorithm: ${strategy}`);
    }

    const videos = await this.youtubeClient.getVideoDetails(videoIds);
    return algorithm.organize(videos, options);
  }
}
```

## Adding New Resource Endpoints

### Resource Definition

```typescript
// src/index.ts
const RESOURCES = [
  // ... existing resources
  {
    uri: 'custom://resource/{id}',
    name: 'Custom Resource',
    description: 'Custom resource with dynamic parameters',
    mimeType: 'application/json'
  }
];
```

### Resource Handler Implementation

```typescript
// src/index.ts - in ReadResourceRequestSchema handler
if (uri.startsWith('custom://resource/')) {
  const resourceId = uri.replace('custom://resource/', '');
  const resourceData = await customService.getResource(resourceId);

  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(resourceData, null, 2)
    }]
  };
}
```

### Subscription Support

```typescript
// Notify subscribers when resource changes
function notifyCustomResourceUpdate(resourceId: string): void {
  const uri = `custom://resource/${resourceId}`;
  notifyResourceSubscribers(uri);
}

// Use in service
export class CustomService {
  async updateResource(id: string, data: unknown): Promise<void> {
    await this.saveResource(id, data);
    notifyCustomResourceUpdate(id);
  }
}
```

## Configuration Extensions

### Adding Configuration Sections

```typescript
// src/config/schemas.ts
export const CustomConfigSchema = z.object({
  apiEndpoint: z.string().url(),
  timeout: z.number().min(1000).default(30000),
  retries: z.number().min(0).max(5).default(3),
  features: z.object({
    enableAdvanced: z.boolean().default(false),
    enableCache: z.boolean().default(true)
  })
});

// Add to main config schema
export const AppConfigSchema = z.object({
  // ... existing config
  customService: CustomConfigSchema.optional()
});
```

### Environment Variable Support

```typescript
// src/config/index.ts - in buildConfigFromEnv
const baseConfig: Partial<AppConfig> = {
  // ... existing config
  customService: {
    apiEndpoint: env.CUSTOM_API_ENDPOINT || 'https://api.example.com',
    timeout: Number(env.CUSTOM_TIMEOUT) || 30000,
    retries: Number(env.CUSTOM_RETRIES) || 3,
    features: {
      enableAdvanced: env.CUSTOM_ENABLE_ADVANCED === 'true',
      enableCache: env.CUSTOM_ENABLE_CACHE !== 'false'
    }
  }
};
```

## Hook System (Future)

### Hook Interface Design

```typescript
// src/hooks/types.ts
export interface Hook<T = unknown> {
  name: string;
  priority: number;
  handler: (data: T, context: HookContext) => Promise<T | void>;
}

export interface HookContext {
  operation: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

// src/hooks/manager.ts
export class HookManager {
  private hooks: Map<string, Hook[]> = new Map();

  register<T>(hookName: string, hook: Hook<T>): void {
    const hooks = this.hooks.get(hookName) || [];
    hooks.push(hook);
    hooks.sort((a, b) => a.priority - b.priority);
    this.hooks.set(hookName, hooks);
  }

  async execute<T>(
    hookName: string,
    data: T,
    context: HookContext
  ): Promise<T> {
    const hooks = this.hooks.get(hookName) || [];
    let result = data;

    for (const hook of hooks) {
      const hookResult = await hook.handler(result, context);
      if (hookResult !== undefined) {
        result = hookResult;
      }
    }

    return result;
  }
}
```

### Usage Example

```typescript
// Register hooks
hookManager.register('before-metadata-update', {
  name: 'validation-hook',
  priority: 10,
  handler: async (metadata, context) => {
    // Validate metadata before update
    await validateMetadata(metadata);
    return metadata;
  }
});

// Execute hooks
const processedMetadata = await hookManager.execute(
  'before-metadata-update',
  metadata,
  { operation: 'update', timestamp: new Date(), metadata: {} }
);
```

## Extension Best Practices

1. **Follow Existing Patterns**: Use established patterns for consistency
2. **Error Handling**: Implement comprehensive error handling
3. **Type Safety**: Use TypeScript strictly with proper types
4. **Testing**: Include unit tests for all extensions
5. **Documentation**: Document new functionality thoroughly
6. **Configuration**: Make extensions configurable
7. **Backwards Compatibility**: Ensure extensions don't break existing functionality
8. **Performance**: Consider performance impact of extensions

## Extension Examples

See the `docs/dev/examples/` directory for complete extension examples:
- Custom metadata provider implementation
- Custom backup strategy with cloud storage
- Advanced playlist algorithm with ML
- Custom MCP tool with complex validation

This guide provides the foundation for extending YouTube MCP Extended with custom functionality while maintaining code quality and system integrity.