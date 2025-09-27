# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube MCP Extended is a Model Context Protocol server for managing YouTube channels via Claude Desktop. It provides OAuth authentication, video metadata management, scheduling, playlist organization, and backup capabilities through a local MCP server that interfaces with the YouTube Data API v3.

## Development Commands

### Core Build & Development
```bash
# Install dependencies
npm install

# Build for production (TypeScript compilation)
npm run build:basic

# Development mode with hot reload
npm run dev:basic          # Uses tsx watch
npm run start:dev         # Alternative with tsx watch

# Start production server
npm start                 # Runs dist/index.js
npm run start:prod        # With NODE_ENV=production
```

### Code Quality
```bash
# Linting
npm run lint              # Check TypeScript files
npm run lint:fix          # Auto-fix linting issues

# Formatting
npm run format            # Prettier format all TypeScript files

# Testing
npm test                  # Run Vitest
npm run test:watch        # Watch mode for tests

# Clean build artifacts
npm run clean             # Remove dist directory
```

### Advanced Build Commands (require agents/buildops/)
```bash
npm run dev               # Uses build-scripts.ts dev
npm run build             # Uses build-scripts.ts build
npm run build:watch       # Watch mode compilation
npm run build:deploy      # Deploy build
npm run validate:env      # Validate environment setup
```

Note: The advanced build commands reference `agents/buildops/` which doesn't currently exist in the repository.

## Architecture

### Core Service Structure
The application follows a modular service-based architecture with clear separation of concerns:

- **MCP Server** (`src/index.ts`): Main entry point implementing the Model Context Protocol server, handles tool registration and request routing
- **OAuth Service** (`src/auth/`): PKCE-based OAuth 2.0 flow with encrypted token storage
- **YouTube Client** (`src/youtube/client.ts`): Centralized API client with quota management and rate limiting
- **Batch Orchestrator** (`src/batch/`): Manages asynchronous batch operations with progress streaming via `batch://status/<id>` resources
- **Metadata Service** (`src/metadata/`): Generates and applies video metadata with guardrail-based review workflow
- **Playlist Service** (`src/playlist/`): Handles playlist creation and video organization
- **Scheduler** (`src/scheduler/`): Implements video scheduling with batch support
- **Backup Service** (`src/backup/`): JSON-based metadata backup and restore system
- **Transcript Manager** (`src/transcript/`): Retrieves and manages video captions

### Key Patterns

**Token Management**: OAuth tokens are stored in `tokens/oauth_tokens.json` with optional AES-256-GCM encryption when `OAUTH_ENCRYPTION_SECRET` is set.

**Batch Processing**: Long-running operations (scheduling, playlist updates) execute as batches with:
- Unique batch IDs for tracking
- Progress streaming via MCP resource subscriptions
- Serial queue processing to respect API quotas
- Detailed operation logging with success/failure states

**Metadata Review Workflow**:
1. Suggestions stored in `storage/metadata-suggestions/<id>.json`
2. Mandatory guardrail acknowledgment before application
3. Automatic backup creation on metadata changes

**Quota Management**: Built-in YouTube API quota tracking (10,000 units/day) with cost calculation per operation type.

## Environment Configuration

Required environment variables:
- `YOUTUBE_CLIENT_ID`: OAuth client ID from Google Cloud Console
- `YOUTUBE_CLIENT_SECRET`: OAuth client secret
- `YOUTUBE_REDIRECT_URI` (optional): Defaults to `http://localhost:3000/callback`
- `OAUTH_ENCRYPTION_SECRET` (optional): Enables token encryption

## MCP Tools

The server exposes these tools to Claude Desktop:

- **OAuth**: `start_oauth_flow`, `complete_oauth_flow`
- **Videos**: `list_videos`, `get_video_transcript`
- **Metadata**: `generate_metadata_suggestions`, `apply_metadata`
- **Scheduling**: `schedule_videos` (preview/apply modes)
- **Playlists**: `create_playlist`, `add_videos_to_playlist`, `organize_playlists`
- **Backup**: `backup_video_metadata`, `restore_video_metadata`
- **Monitoring**: `get_batch_status`

## Testing Approach

Currently no automated tests exist (v0.0.1). Manual verification required:
1. Build with `npm run build:basic`
2. Test OAuth flow completion
3. Verify each MCP tool through Claude Desktop
4. Check batch operation progress streaming
5. Validate guardrail enforcement in metadata updates

## Important Directories

- `tokens/`: OAuth tokens (gitignored)
- `backups/`: Video metadata backups organized by date (gitignored)
- `storage/metadata-suggestions/`: Pending metadata suggestions
- `dist/`: Compiled JavaScript output