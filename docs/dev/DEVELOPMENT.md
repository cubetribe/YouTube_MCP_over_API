# Development Guide

## Overview

This guide provides comprehensive information for developers working on YouTube MCP Extended, including environment setup, development workflows, coding standards, and best practices.

## Development Environment Setup

### Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **npm**: Version 9.0.0 or higher (comes with Node.js)
- **TypeScript**: Global installation optional (included in devDependencies)
- **Git**: Version 2.30 or higher

### Required Tools

```bash
# Global tools (optional but recommended)
npm install -g tsx typescript

# Development tools
npm install -g prettier eslint
```

### Environment Setup

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd youtube-mcp-extended
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   ```bash
   # Copy environment template
   cp .env.example .env.local

   # Configure required variables
   YOUTUBE_CLIENT_ID=your_google_oauth_client_id
   YOUTUBE_CLIENT_SECRET=your_google_oauth_client_secret
   YOUTUBE_REDIRECT_URI=http://localhost:3000/callback
   OAUTH_ENCRYPTION_SECRET=your_32_character_encryption_key
   ```

4. **Verify Setup**:
   ```bash
   npm run type-check
   npm run lint
   npm test
   ```

### Google Cloud Platform Setup

1. **Create a Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable YouTube Data API v3

2. **OAuth Configuration**:
   - Go to APIs & Services > Credentials
   - Create OAuth 2.0 Client ID
   - Set redirect URI: `http://localhost:3000/callback`
   - Download credentials and extract client ID/secret

3. **API Quotas**:
   - Default quota: 10,000 units/day
   - Monitor usage in Google Cloud Console
   - Request quota increase if needed

## Project Structure

```
youtube-mcp-extended/
├── src/                    # Source code
│   ├── auth/              # Authentication services
│   ├── backup/            # Backup and restore services
│   ├── batch/             # Batch processing engine
│   ├── config/            # Configuration management
│   ├── errors/            # Custom error classes
│   ├── lib/               # Shared utilities
│   ├── metadata/          # Metadata generation services
│   ├── playlist/          # Playlist management
│   ├── scheduler/         # Video scheduling
│   ├── thumbnail/         # Thumbnail concept generation
│   ├── transcript/        # Transcript management
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── youtube/           # YouTube API client
│   └── index.ts           # Main MCP server entry point
├── docs/                  # Documentation
│   ├── dev/               # Developer documentation
│   └── user/              # User documentation
├── dist/                  # Compiled JavaScript (generated)
├── __tests__/             # Test files
├── agents/                # Build and deployment scripts
└── package.json           # Project configuration
```

## Development Commands

### Core Commands

```bash
# Development
npm run dev:basic          # Start with tsx watch (recommended)
npm run dev                # Start with build scripts (requires agents/)
npm run start:dev          # Alternative development start

# Building
npm run build:basic        # TypeScript compilation only
npm run build              # Advanced build with scripts
npm run clean              # Clean build artifacts

# Code Quality
npm run lint               # Run ESLint
npm run lint:fix           # Fix linting issues
npm run format             # Format with Prettier
npm run type-check         # TypeScript type checking

# Testing
npm test                   # Run tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report

# Utilities
npm run check              # Run all checks (type, lint, test)
npm run precommit          # Pre-commit hook
```

### Advanced Commands

```bash
# Build variations
npm run build:dev          # Development build
npm run build:prod         # Production build
npm run build:watch        # Watch mode compilation
npm run build:analyze      # Bundle analysis
npm run build:deploy       # Deployment build

# Environment validation
npm run validate:env       # Validate environment setup
npm run generate:env       # Generate environment template

# Docker
npm run docker:build       # Build Docker image
npm run docker:run         # Run in container
npm run docker:dev         # Development container

# Release
npm run version:patch      # Patch version bump
npm run version:minor      # Minor version bump
npm run version:major      # Major version bump
```

## Code Organization

### Module Structure

Each module follows consistent structure:

```typescript
// Module directory structure
module-name/
├── index.ts               # Public API exports
├── service.ts             # Main service implementation
├── types.ts               # Module-specific types
├── utils.ts               # Module utilities
├── constants.ts           # Module constants
└── __tests__/             # Module tests
    ├── service.test.ts
    └── utils.test.ts
```

### Import/Export Patterns

```typescript
// Barrel exports in index.ts
export { ServiceClass } from './service.js';
export * from './types.js';
export { CONSTANT_NAME } from './constants.js';

// Internal imports
import { ServiceClass } from '../other-module/index.js';
import type { TypeName } from '../types/index.js';

// External imports
import { z } from 'zod';
import { google } from 'googleapis';
```

### File Naming Conventions

- **Services**: `service-name.ts` (kebab-case)
- **Types**: `types.ts` or `index.ts` for type-only modules
- **Utilities**: `util-name.ts` (kebab-case)
- **Constants**: `constants.ts` or integrated in main files
- **Tests**: `*.test.ts` or `*.spec.ts`

## Coding Standards

### TypeScript Guidelines

1. **Strict TypeScript Configuration**:
   ```json
   {
     "strict": true,
     "noImplicitAny": true,
     "strictNullChecks": true,
     "strictFunctionTypes": true
   }
   ```

2. **Type Definitions**:
   ```typescript
   // Use interfaces for object shapes
   interface UserData {
     id: string;
     name: string;
     email?: string;
   }

   // Use types for unions and computed types
   type Status = 'pending' | 'completed' | 'failed';
   type UserKeys = keyof UserData;

   // Use enums sparingly, prefer union types
   const Status = {
     PENDING: 'pending',
     COMPLETED: 'completed',
     FAILED: 'failed'
   } as const;
   ```

3. **Generic Usage**:
   ```typescript
   // Clear generic constraints
   interface Repository<T extends { id: string }> {
     save(item: T): Promise<T>;
     findById(id: string): Promise<T | null>;
   }

   // Utility types
   type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
   ```

### Code Style

1. **Naming Conventions**:
   ```typescript
   // Classes: PascalCase
   class YouTubeClient {}

   // Functions and variables: camelCase
   const getUserData = () => {};
   const isAuthenticated = false;

   // Constants: UPPER_SNAKE_CASE
   const API_BASE_URL = 'https://api.example.com';

   // Types and interfaces: PascalCase
   interface ApiResponse {}
   type ServiceStatus = 'active' | 'inactive';
   ```

2. **Function Declarations**:
   ```typescript
   // Prefer arrow functions for inline functions
   const processItems = (items: Item[]) => {
     return items.map(item => transformItem(item));
   };

   // Use function declarations for main functions
   export function createService(config: Config): Service {
     return new ServiceImpl(config);
   }

   // Async functions
   export async function fetchData(id: string): Promise<Data> {
     const response = await api.get(`/data/${id}`);
     return response.data;
   }
   ```

3. **Error Handling**:
   ```typescript
   // Custom error classes
   export class ValidationError extends Error {
     constructor(
       message: string,
       public field: string,
       public value: unknown
     ) {
       super(message);
       this.name = 'ValidationError';
     }
   }

   // Error handling patterns
   try {
     const result = await riskyOperation();
     return { success: true, data: result };
   } catch (error) {
     if (error instanceof ValidationError) {
       return { success: false, error: error.message };
     }
     throw error; // Re-throw unknown errors
   }
   ```

### Documentation Standards

1. **JSDoc Comments**:
   ```typescript
   /**
    * Processes video metadata and generates optimized suggestions.
    *
    * @param input - The metadata generation input containing video details
    * @param options - Optional configuration for the generation process
    * @returns Promise resolving to metadata suggestions with confidence scores
    *
    * @example
    * ```typescript
    * const suggestions = await generateMetadata({
    *   videoId: 'abc123',
    *   title: 'Sample Video',
    *   description: 'Video description',
    *   tags: ['tag1', 'tag2']
    * });
    * ```
    *
    * @throws {ValidationError} When input validation fails
    * @throws {APIError} When YouTube API call fails
    */
   export async function generateMetadata(
     input: MetadataInput,
     options?: GenerationOptions
   ): Promise<MetadataSuggestion> {
     // Implementation
   }
   ```

2. **Interface Documentation**:
   ```typescript
   /**
    * Configuration options for YouTube API client
    */
   interface YouTubeClientConfig {
     /** OAuth client for authentication */
     oauthClient: OAuth2Client;

     /** Daily quota limit (default: 10000) */
     quotaLimit?: number;

     /** Rate limiting configuration */
     rateLimiter?: {
       /** Maximum requests per minute */
       maxRequestsPerMinute: number;
     };
   }
   ```

### Testing Guidelines

1. **Test Structure**:
   ```typescript
   describe('YouTubeClient', () => {
     let client: YouTubeClient;
     let mockOAuth: jest.Mocked<OAuth2Client>;

     beforeEach(() => {
       mockOAuth = createMockOAuth();
       client = new YouTubeClient({ oauthClient: mockOAuth });
     });

     describe('listMyVideos', () => {
       it('should return videos with default pagination', async () => {
         // Arrange
         const expectedVideos = [createMockVideo()];
         mockOAuth.request.mockResolvedValue({
           data: { items: expectedVideos }
         });

         // Act
         const result = await client.listMyVideos();

         // Assert
         expect(result).toEqual(expectedVideos);
         expect(mockOAuth.request).toHaveBeenCalledWith({
           url: expect.stringContaining('videos'),
           method: 'GET'
         });
       });

       it('should handle API errors gracefully', async () => {
         // Arrange
         mockOAuth.request.mockRejectedValue(new Error('API Error'));

         // Act & Assert
         await expect(client.listMyVideos()).rejects.toThrow('API Error');
       });
     });
   });
   ```

2. **Mock Patterns**:
   ```typescript
   // Create comprehensive mocks
   function createMockVideo(overrides: Partial<YouTubeVideo> = {}): YouTubeVideo {
     return {
       id: 'video-123',
       title: 'Test Video',
       description: 'Test description',
       tags: ['test'],
       categoryId: '22',
       privacyStatus: 'private',
       publishedAt: '2023-01-01T00:00:00Z',
       thumbnails: {},
       ...overrides
     };
   }

   // Mock external dependencies
   jest.mock('googleapis', () => ({
     google: {
       youtube: jest.fn(() => ({
         videos: {
           list: jest.fn(),
           update: jest.fn()
         }
       }))
     }
   }));
   ```

## Development Workflows

### Feature Development

1. **Branch Creation**:
   ```bash
   git checkout -b feature/feature-name
   ```

2. **Development Cycle**:
   ```bash
   # Start development server
   npm run dev:basic

   # Make changes, run checks frequently
   npm run type-check
   npm run lint:fix
   npm test

   # Pre-commit checks
   npm run precommit
   ```

3. **Testing Strategy**:
   ```bash
   # Unit tests
   npm test src/module-name

   # Integration tests
   npm test src/__tests__/integration

   # Watch mode during development
   npm run test:watch
   ```

### Debugging Techniques

1. **TypeScript Debugging**:
   ```bash
   # Debug with inspect
   npm run dev:debug

   # Debug with breakpoints
   npm run dev:inspect
   ```

2. **Logging in Development**:
   ```typescript
   // Use conditional logging (not in MCP production)
   if (process.env.NODE_ENV === 'development') {
     console.log('Debug info:', data);
   }

   // Use file logging for debugging
   import fs from 'fs';
   const debugLog = (message: string) => {
     if (process.env.DEBUG_LOG) {
       fs.appendFileSync('debug.log', `${new Date().toISOString()}: ${message}\n`);
     }
   };
   ```

3. **API Testing**:
   ```bash
   # Test OAuth flow
   curl -X POST http://localhost:3000/auth/start

   # Test MCP tools (requires Claude Desktop)
   # Use Claude Desktop with server configured
   ```

### Performance Profiling

1. **Node.js Profiling**:
   ```bash
   # CPU profiling
   node --prof dist/index.js

   # Memory profiling
   node --inspect --max-old-space-size=4096 dist/index.js
   ```

2. **Performance Monitoring**:
   ```typescript
   // Simple performance timing
   const startTime = performance.now();
   await expensiveOperation();
   const duration = performance.now() - startTime;
   console.log(`Operation took ${duration}ms`);

   // Memory usage monitoring
   const memBefore = process.memoryUsage();
   await operation();
   const memAfter = process.memoryUsage();
   console.log('Memory diff:', {
     heapUsed: memAfter.heapUsed - memBefore.heapUsed,
     external: memAfter.external - memBefore.external
   });
   ```

## Local Development Tips

### Environment Management

1. **Multiple Environments**:
   ```bash
   # Use different config files
   NODE_ENV=development npm run dev:basic
   NODE_ENV=test npm test
   NODE_ENV=production npm start
   ```

2. **Secret Management**:
   ```bash
   # Use .env.local for local secrets (gitignored)
   echo "OAUTH_ENCRYPTION_SECRET=your-secret-key" >> .env.local

   # Use different secrets per environment
   OAUTH_ENCRYPTION_SECRET_DEV=dev-secret
   OAUTH_ENCRYPTION_SECRET_PROD=prod-secret
   ```

### Quick Development Commands

```bash
# Quick start (most common)
npm run dev:basic

# Full development setup with all checks
npm run check && npm run dev:basic

# Reset development environment
npm run clean && npm install && npm run dev:basic

# Update dependencies
npm update && npm audit fix

# Generate fresh environment template
npm run generate:env
```

### IDE Configuration

#### VS Code Settings

```json
// .vscode/settings.json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.suggest.autoImports": true
}
```

#### Recommended Extensions

- TypeScript Importer
- ESLint
- Prettier
- GitLens
- Thunder Client (for API testing)

### Common Development Issues

1. **Module Resolution Issues**:
   ```typescript
   // Use .js extensions in imports (required for ES modules)
   import { service } from './service.js';
   import type { Type } from '../types/index.js';
   ```

2. **OAuth Development**:
   ```bash
   # Use localhost redirect for development
   YOUTUBE_REDIRECT_URI=http://localhost:3000/callback

   # Test OAuth flow manually
   # 1. Start server: npm run dev:basic
   # 2. Generate auth URL
   # 3. Complete flow in browser
   ```

3. **TypeScript Compilation**:
   ```bash
   # Clear TypeScript cache
   rm -rf node_modules/.cache/
   npx tsc --build --clean

   # Check specific file
   npx tsc --noEmit src/specific-file.ts
   ```

This development guide provides everything needed to start contributing to YouTube MCP Extended effectively.