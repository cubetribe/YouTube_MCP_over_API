# Configuration Guide

This guide provides complete reference documentation for configuring YouTube MCP Extended, including environment variables, feature flags, security settings, and performance tuning.

## Table of Contents

- [Configuration Overview](#configuration-overview)
- [Environment Variables](#environment-variables)
- [Feature Flags](#feature-flags)
- [Security Configuration](#security-configuration)
- [Performance Tuning](#performance-tuning)
- [Multi-Environment Setup](#multi-environment-setup)
- [Configuration Validation](#configuration-validation)
- [Advanced Settings](#advanced-settings)
- [Configuration Examples](#configuration-examples)

## Configuration Overview

YouTube MCP Extended uses a hierarchical configuration system:

1. **Environment Variables** - Primary configuration method
2. **Configuration Files** - For complex settings
3. **Feature Flags** - Enable/disable functionality
4. **Runtime Configuration** - Dynamic settings via MCP tools

### Configuration Priority

Settings are applied in this order (highest to lowest priority):

1. Command line environment variables
2. `.env.local` file (not tracked in git)
3. `.env.{NODE_ENV}.local` file
4. `.env.{NODE_ENV}` file
5. `.env` file
6. Default values

## Environment Variables

### Core OAuth Configuration

These variables are **required** for basic functionality:

```env
# YouTube OAuth Client (REQUIRED)
YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/callback

# OAuth Scopes (comma-separated)
YOUTUBE_OAUTH_SCOPES=https://www.googleapis.com/auth/youtube,https://www.googleapis.com/auth/youtube.upload
```

#### OAuth Scope Options

| Scope | Description | Required For |
|-------|-------------|--------------|
| `https://www.googleapis.com/auth/youtube` | Read access to YouTube data | Video listing, metadata reading |
| `https://www.googleapis.com/auth/youtube.upload` | Upload and manage videos | Metadata updates, scheduling, playlists |
| `https://www.googleapis.com/auth/youtubepartner-channel-audit` | Channel audit data | Advanced analytics (optional) |

### Security Configuration

```env
# Token Encryption (HIGHLY RECOMMENDED)
OAUTH_ENCRYPTION_SECRET=your-strong-32-plus-character-secret

# Custom Storage Directory
OAUTH_STORAGE_DIR=tokens

# Security Features
FEATURE_ENABLE_ENCRYPTION=true
FEATURE_ENABLE_RATE_LIMITING=true
FEATURE_ENABLE_INPUT_SANITIZATION=true
```

#### Generating Encryption Secrets

```bash
# Method 1: OpenSSL (macOS/Linux)
openssl rand -base64 32

# Method 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Method 3: PowerShell (Windows)
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### Application Environment

```env
# Environment Mode
NODE_ENV=production          # production, development, test

# Logging Configuration
LOG_LEVEL=info              # error, warn, info, debug
ENABLE_FILE_LOGGING=false   # true/false
LOG_DIR=logs               # Directory for log files
```

### YouTube API Configuration

```env
# API Quota Management
YOUTUBE_QUOTA_LIMIT=10000           # Daily quota limit
YOUTUBE_RATE_LIMIT_RPS=100          # Requests per second
YOUTUBE_RATE_LIMIT_RPM=6000         # Requests per minute

# Regional Settings
YOUTUBE_DEFAULT_REGION=US           # Default region code
YOUTUBE_DEFAULT_LANGUAGE=en         # Default language code
```

### Storage Configuration

```env
# Storage Directories
BACKUP_DIR=backups                           # Video metadata backups
METADATA_SUGGESTIONS_DIR=storage/metadata-suggestions  # Suggestion storage
TEMP_DIR=temp                               # Temporary files

# Backup Settings
BACKUP_RETENTION_DAYS=365           # Days to keep backups
BACKUP_COMPRESSION=true             # Enable backup compression
```

### MCP Server Configuration

```env
# Server Identity
MCP_SERVER_NAME=youtube-mcp-extended
MCP_SERVER_VERSION=1.0.0

# Server Capabilities
MCP_ENABLE_RESOURCES=true          # Enable MCP resources
MCP_ENABLE_TOOLS=true              # Enable MCP tools
MCP_ENABLE_PROMPTS=false           # Enable MCP prompts (future)
```

## Feature Flags

Feature flags allow you to enable/disable specific functionality. Use the format `FEATURE_<FLAG_NAME>=true/false`:

### Core Features

```env
# Authentication & API Access
FEATURE_ENABLE_O_AUTH=true
FEATURE_ENABLE_METADATA_GENERATION=true
FEATURE_ENABLE_VIDEO_SCHEDULING=true
FEATURE_ENABLE_PLAYLIST_MANAGEMENT=true
FEATURE_ENABLE_BACKUP_RESTORE=true
FEATURE_ENABLE_BATCH_OPERATIONS=true
FEATURE_ENABLE_THUMBNAIL_CONCEPTS=true
```

### Advanced Features

```env
# Content Analysis
FEATURE_ENABLE_TRANSCRIPT_ANALYSIS=true
FEATURE_ENABLE_METADATA_VALIDATION=true
FEATURE_ENABLE_QUOTA_MONITORING=true
FEATURE_ENABLE_PERFORMANCE_METRICS=false
FEATURE_ENABLE_AUDIT_LOGGING=false
```

### Experimental Features

⚠️ **Use with caution in production**

```env
# Experimental Functionality
FEATURE_ENABLE_ADVANCED_SCHEDULING=false
FEATURE_ENABLE_CONTENT_ANALYSIS=false
FEATURE_ENABLE_AUTOMATIC_TAGGING=false
FEATURE_ENABLE_ML_OPTIMIZATION=false
```

### Development Features

```env
# Development Tools
FEATURE_ENABLE_DEBUG_MODE=false     # Enable debug logging
FEATURE_ENABLE_MOCK_SERVICES=false  # Use mock YouTube API
FEATURE_ENABLE_BETA_FEATURES=false  # Enable beta functionality
FEATURE_ENABLE_DEV_TOOLS=false      # Development utilities
```

### Integration Features

```env
# Future Integrations
FEATURE_ENABLE_WEBHOOKS=false
FEATURE_ENABLE_API_EXTENSIONS=false
FEATURE_ENABLE_THIRD_PARTY_INTEGRATIONS=false
```

## Security Configuration

### Token Security

```env
# Encryption Settings
OAUTH_ENCRYPTION_SECRET=your-strong-secret
OAUTH_ENCRYPTION_ALGORITHM=aes-256-gcm  # Encryption algorithm
OAUTH_TOKEN_EXPIRY=3600                 # Token expiry in seconds
```

### Access Control

```env
# Security Features
FEATURE_ENABLE_COMPLIANCE_MODE=false    # Enhanced security mode
FEATURE_ENABLE_AUDIT_LOGGING=false      # Log all operations
FEATURE_ENABLE_INPUT_SANITIZATION=true  # Sanitize inputs
```

### Rate Limiting

```env
# API Rate Limits
YOUTUBE_RATE_LIMIT_RPS=100              # Max requests per second
YOUTUBE_RATE_LIMIT_RPM=6000             # Max requests per minute
YOUTUBE_RATE_LIMIT_BURST=10             # Burst allowance

# Backoff Strategy
YOUTUBE_RETRY_MAX_ATTEMPTS=3            # Max retry attempts
YOUTUBE_RETRY_DELAY_MS=1000             # Initial retry delay
YOUTUBE_RETRY_BACKOFF_FACTOR=2          # Exponential backoff factor
```

## Performance Tuning

### Memory Management

```env
# Memory Settings
NODE_OPTIONS=--max-old-space-size=2048  # Max heap size (MB)
```

### Concurrency Settings

```env
# Batch Processing
BATCH_MAX_CONCURRENT_OPERATIONS=5       # Max parallel operations
BATCH_OPERATION_TIMEOUT_MS=30000        # Operation timeout
BATCH_QUEUE_MAX_SIZE=100                # Max queued batches
```

### Caching Configuration

```env
# Cache Settings
CACHE_ENABLED=true                      # Enable caching
CACHE_TTL_SECONDS=3600                  # Cache time-to-live
CACHE_MAX_SIZE=1000                     # Max cached items
```

## Multi-Environment Setup

### Development Environment

```env
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_FILE_LOGGING=true
FEATURE_ENABLE_DEBUG_MODE=true
FEATURE_ENABLE_DEV_TOOLS=true
FEATURE_ENABLE_BETA_FEATURES=true
YOUTUBE_RATE_LIMIT_RPS=20               # Lower limits for testing
```

### Production Environment

```env
# .env.production
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_FILE_LOGGING=true
FEATURE_ENABLE_AUDIT_LOGGING=true
FEATURE_ENABLE_PERFORMANCE_METRICS=true
OAUTH_ENCRYPTION_SECRET=your-production-secret
FEATURE_ENABLE_COMPLIANCE_MODE=true
```

### Test Environment

```env
# .env.test
NODE_ENV=test
LOG_LEVEL=error
FEATURE_ENABLE_MOCK_SERVICES=true
TEMP_DIR=test-temp
BACKUP_DIR=test-backups
YOUTUBE_RATE_LIMIT_RPS=10               # Minimal limits
```

## Configuration Validation

### Built-in Validation

Use the configuration validation tool:

```bash
# Validate current configuration
npm run validate:env

# Generate example environment file
npm run generate:env
```

### Using MCP Tools

Check configuration through Claude:

```
You: Check the YouTube MCP configuration status
You: Validate the current configuration with details
You: Show me the feature flags status
```

### Validation Checks

The system validates:

- ✅ Required OAuth credentials present
- ✅ Encryption secret strength (production)
- ✅ Directory permissions
- ✅ YouTube API access
- ✅ Feature flag consistency
- ✅ Rate limit reasonableness

## Advanced Settings

### Custom OAuth Configuration

```env
# Advanced OAuth Settings
OAUTH_ACCESS_TYPE=offline               # offline, online
OAUTH_APPROVAL_PROMPT=force             # force, auto
OAUTH_INCLUDE_GRANTED_SCOPES=true       # Include granted scopes
```

### Database-like Storage

```env
# Enhanced Storage Options
STORAGE_BACKEND=filesystem              # filesystem, s3, gcs (future)
STORAGE_ENCRYPTION=true                 # Encrypt stored data
STORAGE_COMPRESSION=true                # Compress stored data
```

### Monitoring & Observability

```env
# Monitoring Configuration
METRICS_ENABLED=false                   # Enable metrics collection
METRICS_PORT=9090                       # Metrics server port
HEALTH_CHECK_ENABLED=true               # Enable health checks
HEALTH_CHECK_PORT=9091                  # Health check port
```

### Content Processing

```env
# Content Analysis Settings
TRANSCRIPT_MAX_LENGTH=10000             # Max transcript length
METADATA_MAX_DESCRIPTION_LENGTH=5000    # Max description length
METADATA_MAX_TAGS=10                    # Max number of tags
```

## Configuration Examples

### High-Volume Channel Setup

```env
# For channels with 1000+ videos
YOUTUBE_QUOTA_LIMIT=50000
YOUTUBE_RATE_LIMIT_RPS=50
YOUTUBE_RATE_LIMIT_RPM=3000
BATCH_MAX_CONCURRENT_OPERATIONS=10
BACKUP_RETENTION_DAYS=90
FEATURE_ENABLE_PERFORMANCE_METRICS=true
CACHE_MAX_SIZE=5000
```

### Security-Focused Setup

```env
# Maximum security configuration
OAUTH_ENCRYPTION_SECRET=your-very-strong-secret-here
FEATURE_ENABLE_ENCRYPTION=true
FEATURE_ENABLE_AUDIT_LOGGING=true
FEATURE_ENABLE_COMPLIANCE_MODE=true
FEATURE_ENABLE_INPUT_SANITIZATION=true
LOG_LEVEL=warn
OAUTH_TOKEN_EXPIRY=1800                 # Shorter token expiry
```

### Development Setup

```env
# Developer-friendly configuration
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_FILE_LOGGING=true
FEATURE_ENABLE_DEBUG_MODE=true
FEATURE_ENABLE_DEV_TOOLS=true
FEATURE_ENABLE_BETA_FEATURES=true
FEATURE_ENABLE_MOCK_SERVICES=false
YOUTUBE_RATE_LIMIT_RPS=10
```

### Minimal Setup

```env
# Bare minimum configuration
YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your-client-secret
OAUTH_ENCRYPTION_SECRET=your-secret
```

## Environment-Specific Configuration Files

### .env.local (Personal Overrides)

```env
# Personal development overrides (not tracked in git)
YOUTUBE_CLIENT_ID=your-personal-client-id
YOUTUBE_CLIENT_SECRET=your-personal-secret
LOG_LEVEL=debug
```

### .env.production.local (Production Secrets)

```env
# Production secrets (not tracked in git)
OAUTH_ENCRYPTION_SECRET=your-production-secret
YOUTUBE_CLIENT_SECRET=your-production-secret
```

## Configuration Troubleshooting

### Common Configuration Issues

#### OAuth Configuration Problems

```bash
# Symptoms: OAuth flow fails
# Check: Client ID format
YOUTUBE_CLIENT_ID=123456789.apps.googleusercontent.com  # ✅ Correct
YOUTUBE_CLIENT_ID=123456789                             # ❌ Incorrect

# Check: Redirect URI exact match
YOUTUBE_REDIRECT_URI=http://localhost:3000/callback     # ✅ Correct
YOUTUBE_REDIRECT_URI=https://localhost:3000/callback    # ❌ Wrong protocol
YOUTUBE_REDIRECT_URI=http://localhost:3000/callback/    # ❌ Extra slash
```

#### Feature Flag Conflicts

```bash
# Some features depend on others
FEATURE_ENABLE_METADATA_GENERATION=true
FEATURE_ENABLE_TRANSCRIPT_ANALYSIS=false    # ❌ Conflict: metadata needs transcripts

# Correct configuration
FEATURE_ENABLE_METADATA_GENERATION=true
FEATURE_ENABLE_TRANSCRIPT_ANALYSIS=true     # ✅ Correct
```

### Configuration Validation Commands

```bash
# Check configuration validity
npm run validate:env

# Show current configuration (safe - no secrets)
npm run config:show

# Test OAuth configuration
npm run test:oauth

# Validate feature flags
npm run validate:features
```

## Configuration Security Best Practices

### Secrets Management

1. **Never commit secrets to git**
   ```bash
   # Add to .gitignore
   .env.local
   .env.*.local
   .env.production
   ```

2. **Use strong encryption secrets**
   ```bash
   # Minimum 32 characters, high entropy
   openssl rand -base64 32
   ```

3. **Rotate credentials regularly**
   - OAuth credentials: Every 6-12 months
   - Encryption secrets: Every 3-6 months
   - Monitor for suspicious activity

### File Permissions

```bash
# Secure configuration files
chmod 600 .env*                    # Owner read/write only
chmod 700 tokens/                  # Owner access only
chmod 700 backups/                 # Owner access only
```

### Environment Isolation

```bash
# Use different credentials per environment
# Development
YOUTUBE_CLIENT_ID=dev-client-id

# Production
YOUTUBE_CLIENT_ID=prod-client-id

# Never use production credentials in development
```

## Next Steps

After configuring your installation:

1. **Test configuration**: Use `npm run validate:env`
2. **Read the [User Guide](USER_GUIDE.md)**: Learn about features
3. **Check [Tools Reference](TOOLS_REFERENCE.md)**: Understand available tools
4. **Review [Troubleshooting](TROUBLESHOOTING.md)**: Prepare for common issues

## Configuration Reference Summary

| Category | Required | Optional | Count |
|----------|----------|----------|-------|
| OAuth | 3 | 2 | 5 |
| Security | 0 | 8 | 8 |
| Performance | 0 | 12 | 12 |
| Features | 0 | 25+ | 25+ |
| Storage | 0 | 6 | 6 |
| Logging | 0 | 4 | 4 |

**Total**: 60+ configuration options available for customization.

---

**Configuration complete!** Your YouTube MCP Extended server is now optimally configured for your environment and use case.