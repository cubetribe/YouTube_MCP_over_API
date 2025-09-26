# Technology Stack

## Core Technologies

- **Runtime**: Node.js 20+ (ES2022 modules)
- **Language**: TypeScript 5.3+ with strict configuration
- **Protocol**: Model Context Protocol (MCP) SDK v1.0.0
- **API Integration**: YouTube Data API v3 via googleapis library
- **Authentication**: OAuth 2.1 with PKCE using google-auth-library
- **Validation**: Zod for runtime type checking and schema validation

## Development Tools

- **Build System**: TypeScript compiler with custom build scripts via tsx
- **Testing**: Vitest with coverage reporting (80% threshold)
- **Linting**: ESLint with TypeScript rules and strict configuration
- **Formatting**: Prettier with consistent code style
- **Package Manager**: npm with package-lock.json

## Architecture Patterns

- **MCP Server**: Implements tools, resources, and prompts for Claude Desktop
- **Agent-Based**: Modular agents in `/agents/` directory for specific functionality
- **Reliability Framework**: Comprehensive error handling, monitoring, and degradation
- **Type Safety**: Strict TypeScript with Zod schemas for runtime validation
- **Async/Await**: Modern async patterns throughout codebase

## Common Commands

```bash
# Development
npm run dev              # Start development server with hot reload
npm run dev:basic        # Basic development without build scripts

# Building
npm run build            # Production build via build scripts
npm run build:basic      # Basic TypeScript compilation
npm run build:watch      # Watch mode compilation
npm run build:deploy     # Deployment build

# Testing
npm test                 # Run test suite with Vitest
npm run test:watch       # Watch mode testing

# Code Quality
npm run lint             # ESLint checking
npm run lint:fix         # Auto-fix linting issues
npm run format           # Prettier formatting

# Utilities
npm run clean            # Remove dist directory
npm run validate:env     # Validate environment variables
```

## Configuration Files

- `tsconfig.json`: Strict TypeScript with ES2022 target
- `vitest.config.ts`: Testing configuration with coverage
- `.eslintrc.json`: Linting rules with TypeScript integration
- `.prettierrc`: Code formatting standards
- `package.json`: Dependencies and scripts

## Environment Variables

Required for OAuth and API access:
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_REDIRECT_URI`: OAuth callback URL
- `OAUTH_ENCRYPTION_SECRET`: Token encryption key