# Architecture Documentation

## Overview

YouTube MCP Extended is a Model Context Protocol (MCP) server that provides AI-powered YouTube channel management capabilities through Claude Desktop. The system follows a modular, service-oriented architecture with clear separation of concerns and robust error handling.

## System Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Claude AI     │────│  MCP Protocol   │────│  YouTube API    │
│   Desktop       │    │     Server      │    │     v3          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                             │                             │
│  ┌─────────────────┐   ┌────▼────┐   ┌─────────────────┐  │
│  │   Auth Layer    │   │   MCP   │   │  Service Layer  │  │
│  │   (OAuth 2.0)   │───│ Server  │───│   (Business     │  │
│  │                 │   │  Core   │   │    Logic)       │  │
│  └─────────────────┘   └─────────┘   └─────────────────┘  │
│                                                          │
│  ┌─────────────────┐   ┌─────────────────┐              │
│  │ Data Persistence│   │   Batch Engine  │              │
│  │   (JSON Files)  │   │  (Orchestrator) │              │
│  └─────────────────┘   └─────────────────┘              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. MCP Server Core (`src/index.ts`)
- **Purpose**: Main entry point implementing Model Context Protocol server
- **Responsibilities**:
  - Tool registration and request routing
  - Resource subscription management
  - Request/response handling and validation
  - Error handling and response formatting
- **Key Features**:
  - 15 MCP tools for YouTube management
  - 7 resource endpoints with subscription support
  - Session-based subscription tracking
  - Real-time batch operation updates

#### 2. Authentication Layer (`src/auth/`)
- **OAuth Service** (`oauth-service.ts`): PKCE-based OAuth 2.0 flow implementation
- **Token Storage** (`token-storage.ts`): Encrypted token persistence with AES-256-GCM
- **Configuration** (`oauth-config.ts`): OAuth client configuration and scope management

#### 3. YouTube Integration (`src/youtube/`)
- **Client** (`client.ts`): Centralized YouTube Data API v3 client
- **Quota Manager** (`quota.ts`): API quota tracking and cost calculation
- **Rate Limiter** (`rate-limiter.ts`): Request throttling and backoff strategies

#### 4. Service Layer

##### Metadata Service (`src/metadata/`)
- Generates AI-powered metadata suggestions
- Implements guardrail-based review workflow
- Stores suggestions with approval requirements

##### Batch Orchestrator (`src/batch/`)
- Manages long-running asynchronous operations
- Provides progress streaming via MCP resources
- Implements serial queue processing for API quota management

##### Playlist Service (`src/playlist/`)
- Handles playlist creation and organization
- Supports category-based and manual grouping strategies
- Integrates with batch processing for bulk operations

##### Scheduler (`src/scheduler/`)
- Implements video publishing schedules
- Supports timezone-aware scheduling
- Provides preview and apply modes

##### Backup Service (`src/backup/`)
- JSON-based metadata backup and restore
- Timestamp-organized backup structure
- Selective field restoration support

##### Transcript Manager (`src/transcript/`)
- Retrieves YouTube video captions
- Multi-language support
- Fallback to auto-generated captions

#### 5. Configuration System (`src/config/`)
- **Schema-based validation**: Zod schemas for type safety
- **Environment profiles**: Development, production, test configurations
- **Feature flags**: Runtime feature toggles
- **Validation engine**: Multi-level configuration validation

#### 6. Type System (`src/types/`)
- Complete TypeScript interface definitions
- Zod schema validation for all inputs
- Custom error classes with context
- Batch operation type definitions

## Data Flow Patterns

### 1. Request Flow
```
Claude Desktop → MCP Protocol → Request Validation → Service Router → Business Logic → YouTube API → Response
```

### 2. Authentication Flow
```
User → OAuth URL Generation → Google OAuth → Authorization Code → Token Exchange → Encrypted Storage
```

### 3. Batch Processing Flow
```
Request → Batch Creation → Queue Processing → Progress Updates → Resource Notifications → Completion
```

### 4. Metadata Review Flow
```
Video Analysis → Suggestion Generation → Guardrail Evaluation → Manual Review → Approval → Application
```

## Design Patterns

### 1. Service Layer Pattern
- Clear separation between MCP protocol handling and business logic
- Each service encapsulates specific domain functionality
- Dependency injection for testability and modularity

### 2. Factory Pattern
- Configuration factory creates environment-specific configs
- YouTube client factory with dependency injection
- Batch operation factories for different operation types

### 3. Observer Pattern
- Resource subscription system for real-time updates
- Batch progress notifications
- Configuration change propagation

### 4. Strategy Pattern
- Playlist organization strategies (category vs manual)
- Metadata optimization strategies (SEO vs engagement)
- Scheduling strategies (even distribution vs time slots)

### 5. Chain of Responsibility
- Configuration validation pipeline
- Error handling chain
- Request processing middleware

### 6. Repository Pattern
- Token storage abstraction
- Backup service abstraction
- Metadata suggestion storage

## Security Architecture

### 1. Authentication Security
- **OAuth 2.0 with PKCE**: Prevents authorization code interception
- **Token Encryption**: AES-256-GCM encryption for stored tokens
- **Scope Limitation**: Minimal required YouTube API scopes

### 2. Data Security
- **No Sensitive Data in Logs**: MCP servers must not log to stdout/stderr
- **File System Isolation**: Restricted file access patterns
- **Secret Management**: Environment variable-based secrets

### 3. API Security
- **Rate Limiting**: Prevents API abuse and quota exhaustion
- **Quota Management**: Real-time quota tracking
- **Error Sanitization**: Clean error messages without sensitive data

## Error Handling Strategy

### 1. Error Hierarchy
```typescript
Error
├── MCPError (MCP protocol errors)
├── AuthenticationError (OAuth failures)
├── ConfigurationError (Config validation)
└── YouTubeAPIError (API failures)
```

### 2. Error Recovery
- **Retry Logic**: Exponential backoff for transient failures
- **Graceful Degradation**: Partial success handling
- **Rollback Support**: Batch operation rollback capabilities

### 3. Error Context
- Detailed error context for debugging
- User-friendly error messages
- Error tracking and metrics

## Performance Considerations

### 1. API Optimization
- **Batch Operations**: Minimize API calls through batching
- **Caching Strategy**: In-memory caching for frequently accessed data
- **Pagination**: Efficient large dataset handling

### 2. Memory Management
- **Streaming Processing**: Large file handling without memory bloat
- **Resource Cleanup**: Proper cleanup of temporary resources
- **Garbage Collection**: Optimized object lifecycle management

### 3. Scalability
- **Stateless Design**: No server-side session state
- **Horizontal Scaling**: Ready for multi-instance deployment
- **Resource Pooling**: Efficient resource utilization

## Dependencies and Integrations

### Core Dependencies
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `googleapis`: YouTube Data API v3 client
- `google-auth-library`: OAuth 2.0 authentication
- `zod`: Runtime type validation
- `uuid`: Unique identifier generation

### Integration Points
- **YouTube Data API v3**: Primary data source
- **Google OAuth 2.0**: Authentication provider
- **File System**: Backup and configuration storage
- **Claude Desktop**: MCP protocol client

## Deployment Architecture

### 1. Local Development
- Direct TypeScript execution with `tsx`
- File-based token storage
- Development-specific configurations

### 2. Production Deployment
- Compiled JavaScript execution
- Environment variable configuration
- Secure token storage with encryption

### 3. Container Deployment
- Docker containerization support
- Environment variable injection
- Volume mounting for persistent data

## Future Architecture Considerations

### 1. Database Integration
- Migration from file-based to database storage
- Relational data modeling for complex relationships
- Query optimization for large datasets

### 2. Microservices Evolution
- Service decomposition for independent scaling
- API gateway for service orchestration
- Event-driven architecture for service communication

### 3. Cloud Integration
- Cloud storage for backups and data
- Managed authentication services
- Serverless function deployment options

## Architecture Decision Records (ADRs)

### ADR-001: MCP Protocol Implementation
- **Decision**: Use Model Context Protocol for Claude Desktop integration
- **Rationale**: Native integration with Claude Desktop ecosystem
- **Consequences**: Limited to Claude Desktop clients, requires MCP compliance

### ADR-002: File-Based Storage
- **Decision**: Use JSON files for data persistence in v1
- **Rationale**: Simplicity, portability, no external dependencies
- **Consequences**: Limited scalability, no ACID transactions

### ADR-003: Service Layer Architecture
- **Decision**: Implement service layer pattern
- **Rationale**: Clear separation of concerns, testability, maintainability
- **Consequences**: Additional abstraction layers, more complex structure

### ADR-004: Batch Processing Design
- **Decision**: Implement async batch processing with progress streaming
- **Rationale**: API quota management, user experience, operation reliability
- **Consequences**: Increased complexity, resource management overhead

### ADR-005: Configuration Management
- **Decision**: Schema-based configuration with validation
- **Rationale**: Type safety, validation, environment-specific configs
- **Consequences**: Configuration complexity, startup validation overhead

## Monitoring and Observability

### 1. Logging Strategy
- **No Console Logging**: MCP servers must not write to stdout/stderr
- **File-Based Logging**: Structured logging to files (development only)
- **Error Tracking**: Comprehensive error context and tracking

### 2. Metrics and Monitoring
- **API Usage Metrics**: Quota consumption, rate limiting
- **Performance Metrics**: Response times, batch processing duration
- **Error Metrics**: Error rates, failure patterns

### 3. Health Checks
- **Configuration Validation**: Startup configuration health
- **Service Dependencies**: YouTube API connectivity
- **Resource Availability**: File system, memory usage

This architecture supports the current requirements while providing a foundation for future growth and scalability.