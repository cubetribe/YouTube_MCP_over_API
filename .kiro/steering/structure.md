# Project Structure

## Root Directory Organization

```
youtube-mcp-extended/
├── src/                    # Main source code
├── agents/                 # Modular agent implementations
├── tests/                  # Test suites (unit, integration, e2e)
├── docs/                   # Documentation by category
├── context/                # External API documentation
├── config/                 # Configuration files
├── backups/                # Metadata backup storage
├── logs/                   # Application logs
├── tokens/                 # OAuth token storage
└── .kiro/                  # Kiro IDE configuration
```

## Source Code Structure (`src/`)

- **`index.ts`**: Main MCP server entry point with tool handlers
- **`types/`**: TypeScript interfaces and Zod schemas
- **`lib/`**: Reliability framework (logging, monitoring, validation, errors)
- **`managers/`**: Business logic managers (transcript, etc.)
- **`utils/`**: Utility functions and helpers
- **`__tests__/`**: Source-adjacent test files

## Agent Architecture (`agents/`)

Each agent follows a consistent structure:
```
agents/{agent-name}/
├── index.ts               # Main agent class
├── README.md              # Agent documentation
├── log.md                 # Development progress log
├── modules/               # Core functionality modules
├── schemas/               # Agent-specific type definitions
├── workflows/             # Multi-step process implementations
└── docs/                  # Agent-specific documentation
```

### Key Agents
- **`metadatamaestro/`**: AI-powered metadata optimization
- **`oauthsmith/`**: OAuth 2.1 authentication system
- **`backupguardian/`**: Data backup and restore functionality
- **`batchconductor/`**: Batch operation management
- **`schedulerguru/`**: Video scheduling algorithms

## Test Organization (`tests/`)

```
tests/
├── unit/                  # Unit tests by module
├── integration/           # API integration tests
├── e2e/                   # End-to-end workflow tests
├── fixtures/              # Test data and mocks
└── setup.ts               # Test environment setup
```

## Documentation Structure (`docs/`)

Organized by functional area:
- **`setup/`**: Installation and configuration
- **`usage/`**: User guides and examples
- **`development/`**: Architecture and contributing
- **`api/`**: MCP interface documentation
- **`auth/`**: OAuth implementation details
- **`youtube/`**: YouTube API integration
- **`ai/`**: AI metadata optimization
- **`automation/`**: Batch processing and scheduling

## Naming Conventions

- **Files**: kebab-case (`oauth-config.ts`, `metadata-generator.ts`)
- **Directories**: lowercase (`agents`, `src`, `tests`)
- **Classes**: PascalCase (`MetadataMaestro`, `OAuthConfigManager`)
- **Functions**: camelCase (`generateMetadata`, `validateConfig`)
- **Constants**: UPPER_SNAKE_CASE (`TOOLS`, `RESOURCES`)
- **Interfaces**: PascalCase with descriptive names (`YouTubeVideo`, `BatchOperation`)

## Import Patterns

- Use `.js` extensions for TypeScript imports (ES modules)
- Relative imports for same-level modules
- Absolute imports from `src/` root for cross-module dependencies
- Group imports: external libraries, internal modules, types

## File Organization Principles

- **Single Responsibility**: Each file has one primary purpose
- **Modular Design**: Related functionality grouped in directories
- **Clear Separation**: Business logic separate from infrastructure
- **Type Safety**: Schemas and types co-located with implementations
- **Documentation**: README.md and log.md files for complex modules