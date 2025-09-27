# Developer Examples

This directory contains practical examples demonstrating how to extend and customize YouTube MCP Extended.

## Available Examples

### 1. Custom Metadata Provider (`custom-metadata-provider.ts`)

**Purpose**: Demonstrates how to create a custom metadata provider that optimizes content for SEO.

**Key Features**:
- SEO keyword optimization
- Call-to-action integration
- Content analysis and scoring
- Custom guardrails and validation
- Comprehensive JSDoc documentation

**Usage**:
```typescript
import { SEOMetadataProvider } from './custom-metadata-provider.js';

const provider = new SEOMetadataProvider({
  targetKeywords: ['tutorial', 'javascript'],
  maxTitleLength: 60,
  includeCallToAction: true
});

const suggestions = await provider.generateSuggestions(videoData);
```

### 2. Custom MCP Tool (`custom-mcp-tool.ts`)

**Purpose**: Shows how to add a new MCP tool that provides video analytics and insights.

**Key Features**:
- Comprehensive analytics collection
- Multiple metric types (views, engagement, retention, demographics)
- AI-powered insights generation
- Performance comparisons
- Full MCP integration pattern

**Usage**:
```typescript
// Register in MCP server tools array
const TOOLS = [
  // ... existing tools
  VIDEO_ANALYTICS_TOOL
];

// Handle in tool request switch
case 'video_analytics': {
  const input = VideoAnalyticsSchema.parse(args);
  return await handleVideoAnalytics(input, youtubeClient);
}
```

## Integration Guidelines

### Adding Custom Providers

1. **Extend Base Provider**:
   ```typescript
   import { MetadataProvider } from '../metadata/providers/base-provider.js';

   export class CustomProvider extends MetadataProvider {
     name = 'custom-provider';
     version = '1.0.0';
     // Implementation...
   }
   ```

2. **Register with Service**:
   ```typescript
   // In metadata-service.ts
   this.registerProvider(new CustomProvider(config));
   ```

3. **Update Configuration**:
   ```typescript
   // Add to config schema
   customProvider: CustomProviderConfigSchema.optional()
   ```

### Adding Custom Tools

1. **Define Schema**:
   ```typescript
   export const CustomToolSchema = z.object({
     // Define input parameters
   });
   ```

2. **Register Tool**:
   ```typescript
   // In index.ts TOOLS array
   {
     name: 'custom_tool',
     description: 'Tool description',
     inputSchema: zodToJsonSchema(CustomToolSchema)
   }
   ```

3. **Implement Handler**:
   ```typescript
   // In index.ts switch statement
   case 'custom_tool': {
     const input = CustomToolSchema.parse(args);
     const result = await handleCustomTool(input);
     return { content: [{ type: 'text', text: JSON.stringify(result) }] };
   }
   ```

## Best Practices

### Code Quality
- Follow TypeScript strict mode
- Use comprehensive JSDoc comments
- Include usage examples in documentation
- Implement proper error handling
- Add input validation with Zod schemas

### Testing
- Write unit tests for all custom logic
- Include integration tests for MCP tools
- Mock external dependencies
- Test error scenarios
- Validate schema compliance

### Performance
- Consider quota costs for YouTube API calls
- Implement caching where appropriate
- Use batch operations when possible
- Monitor memory usage for large datasets
- Implement rate limiting for custom endpoints

### Security
- Validate all inputs thoroughly
- Sanitize user-provided content
- Follow principle of least privilege
- Log security-relevant events
- Implement proper authentication checks

## Example Integration Workflow

1. **Development**:
   ```bash
   # Create custom provider/tool
   npm run dev:basic

   # Test implementation
   npm test src/custom-feature

   # Validate integration
   npm run type-check
   npm run lint
   ```

2. **Testing**:
   ```bash
   # Unit tests
   npm test src/custom-feature/__tests__

   # Integration tests
   npm run test:integration

   # MCP compliance
   npm test src/__tests__/mcp
   ```

3. **Deployment**:
   ```bash
   # Build for production
   npm run build:prod

   # Validate build
   npm run check:all

   # Deploy
   npm run deploy
   ```

## Common Patterns

### Service Factory Pattern
```typescript
export class CustomServiceFactory {
  static create(config: CustomConfig): CustomService {
    return new CustomService(config);
  }
}
```

### Strategy Pattern
```typescript
export interface ProcessingStrategy {
  process(input: any): Promise<any>;
}

export class CustomProcessor {
  constructor(private strategy: ProcessingStrategy) {}
}
```

### Observer Pattern
```typescript
export class CustomService extends EventEmitter {
  async process(data: any): Promise<void> {
    this.emit('processing', data);
    // Process data
    this.emit('completed', result);
  }
}
```

## Troubleshooting

### Common Issues

1. **Schema Validation Errors**:
   - Ensure Zod schemas match input data types
   - Check for required vs optional fields
   - Validate nested object structures

2. **MCP Integration Issues**:
   - Verify tool registration in TOOLS array
   - Check handler implementation in switch statement
   - Validate response format matches MCP spec

3. **Performance Problems**:
   - Review quota usage and API call patterns
   - Implement caching for expensive operations
   - Use streaming for large datasets

4. **Authentication Errors**:
   - Verify OAuth scope requirements
   - Check token refresh handling
   - Validate API permissions

### Debug Commands

```bash
# Debug with inspection
npm run dev:debug

# Verbose logging
DEBUG=* npm run dev:basic

# Type checking with details
npm run type-check -- --listFiles

# Lint with fix suggestions
npm run lint -- --fix-dry-run
```

## Contributing Examples

When contributing new examples:

1. **Follow naming conventions**: `custom-feature-type.ts`
2. **Include comprehensive documentation**: JSDoc and README updates
3. **Add tests**: Unit and integration tests
4. **Validate compatibility**: Test with existing system
5. **Update this README**: Add your example to the list

For questions or improvements to these examples, please see the [Contributing Guide](../../CONTRIBUTING.md).