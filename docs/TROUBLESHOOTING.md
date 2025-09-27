# Troubleshooting Guide

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with YouTube MCP Extended. Issues are organized by category with symptoms, causes, and step-by-step solutions.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [Configuration Problems](#configuration-problems)
- [OAuth Authentication Issues](#oauth-authentication-issues)
- [YouTube API Problems](#youtube-api-problems)
- [MCP Connection Issues](#mcp-connection-issues)
- [Metadata and Content Issues](#metadata-and-content-issues)
- [Batch Operation Problems](#batch-operation-problems)
- [Performance Issues](#performance-issues)
- [Error Message Reference](#error-message-reference)
- [Advanced Debugging](#advanced-debugging)
- [Getting Additional Help](#getting-additional-help)

## Quick Diagnostics

### Health Check Commands

Start troubleshooting with these diagnostic commands:

```bash
# Check Node.js version
node --version  # Should be 20.0.0 or higher

# Verify installation
npm run build:basic
ls dist/  # Should show compiled files

# Test configuration
npm run validate:env

# Check MCP tools availability
# In Claude Desktop:
You: Check the YouTube MCP configuration status
You: List available YouTube tools
```

### System Requirements Verification

| Component | Requirement | Check Command |
|-----------|-------------|---------------|
| Node.js | 20.0.0+ | `node --version` |
| npm | 9.0.0+ | `npm --version` |
| Memory | 512MB+ | Check system memory |
| Storage | 500MB+ | `df -h` (Unix) or `dir` (Windows) |
| Network | Stable internet | `ping google.com` |

## Installation Issues

### Node.js Version Problems

#### Symptoms
- `Error: Node.js version 20.0.0 or higher required`
- Build failures with version-related errors
- npm compatibility warnings

#### Diagnosis
```bash
node --version
npm --version
```

#### Solutions

**Option 1: Update Node.js directly**
1. Download latest LTS from [nodejs.org](https://nodejs.org/)
2. Install and restart terminal
3. Verify: `node --version`

**Option 2: Use Node Version Manager (Recommended)**

*macOS/Linux:*
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install and use Node 20
nvm install 20
nvm use 20
nvm alias default 20
```

*Windows:*
```powershell
# Install nvm-windows
# Download from: https://github.com/coreybutler/nvm-windows/releases

# Install Node 20
nvm install 20.0.0
nvm use 20.0.0
```

---

### npm Installation Failures

#### Symptoms
- `EACCES` permission errors
- `ENOENT` file not found errors
- Dependency resolution failures
- Network timeout errors

#### Diagnosis
```bash
npm config list
npm cache verify
```

#### Solutions

**Permission Issues (macOS/Linux):**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Alternative: Use nvm instead of system Node.js
```

**Permission Issues (Windows):**
```cmd
# Run Command Prompt as Administrator
npm install -g npm
```

**Network Issues:**
```bash
# Clear npm cache
npm cache clean --force

# Try different registry
npm config set registry https://registry.npmjs.org/

# Increase timeout
npm config set timeout 60000
```

**Dependency Issues:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Force resolution
npm install --legacy-peer-deps
```

---

### Build Failures

#### Symptoms
- TypeScript compilation errors
- Missing dependencies
- Build script failures

#### Diagnosis
```bash
npm run type-check
npm run lint
```

#### Solutions

**TypeScript Issues:**
```bash
# Clean build
rm -rf dist/
npm run build:basic

# Check TypeScript installation
npx tsc --version

# Manual compilation with verbose output
npx tsc --verbose
```

**Missing Dependencies:**
```bash
# Reinstall dependencies
npm ci

# Check for peer dependency issues
npm ls
```

**Build Tool Issues:**
```bash
# Check build script
npm run build:basic -- --verbose

# Alternative build method
npx tsc
```

## Configuration Problems

### Environment Variable Issues

#### Symptoms
- `Configuration validation failed`
- `Required environment variable missing`
- OAuth setup failures

#### Diagnosis
```bash
# Check environment variables
printenv | grep YOUTUBE
printenv | grep OAUTH

# Validate configuration
npm run validate:env
```

#### Solutions

**Missing .env File:**
```bash
# Create from template
cp .env.example .env

# Edit with your values
nano .env  # or your preferred editor
```

**Incorrect Variable Names:**
```bash
# Common mistakes:
GOOGLE_CLIENT_ID=xxx        # ❌ Should be YOUTUBE_CLIENT_ID
YOUTUBE_CLIENT_SECRET=      # ❌ Empty value
OAUTH_ENCRYPTION_SECRET=123 # ❌ Too short (minimum 32 chars)
```

**Variable Priority Issues:**
```bash
# Check all .env files
ls -la .env*

# Environment variable precedence:
# 1. Command line variables
# 2. .env.local
# 3. .env.{NODE_ENV}.local
# 4. .env.{NODE_ENV}
# 5. .env
```

---

### Path Configuration Issues

#### Symptoms
- Claude Desktop can't find the server
- `Command not found` errors
- `No such file or directory` errors

#### Diagnosis
```bash
# Check current directory
pwd

# Verify files exist
ls -la dist/index.js

# Check Claude config file
cat ~/.config/Claude/claude_desktop_config.json  # Linux
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json  # macOS
```

#### Solutions

**Incorrect Paths:**
```json
{
  "mcpServers": {
    "youtube-extended": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/absolute/path/to/youtube_MetaData_MCP"  ✅
    }
  }
}
```

**Get Absolute Path:**
```bash
# macOS/Linux
cd youtube_MetaData_MCP
pwd

# Windows
cd youtube_MetaData_MCP
echo %cd%

# PowerShell
Get-Location
```

**File Permissions:**
```bash
# Make sure files are accessible
chmod +r dist/index.js
chmod +x dist/index.js
```

## OAuth Authentication Issues

### OAuth Flow Failures

#### Symptoms
- `redirect_uri_mismatch` errors
- `invalid_client` errors
- `access_denied` errors
- Authentication timeouts

#### Diagnosis
```bash
# Check OAuth configuration
You: Check OAuth configuration status
You: Show current environment variables (filtered)
```

#### Solutions

**Redirect URI Mismatch:**
1. **Check Google Cloud Console:**
   - Go to APIs & Services → Credentials
   - Open your OAuth client
   - Verify authorized redirect URIs includes: `http://localhost:3000/callback`
   - Exact match required (no trailing slash, no HTTPS)

2. **Check Environment Configuration:**
   ```env
   YOUTUBE_REDIRECT_URI=http://localhost:3000/callback  ✅
   YOUTUBE_REDIRECT_URI=https://localhost:3000/callback ❌ (HTTPS)
   YOUTUBE_REDIRECT_URI=http://localhost:3000/callback/ ❌ (trailing slash)
   ```

**Invalid Client Errors:**
1. **Verify Client Credentials:**
   ```env
   YOUTUBE_CLIENT_ID=123456789.apps.googleusercontent.com  ✅
   YOUTUBE_CLIENT_ID=123456789  ❌ (incomplete)
   ```

2. **Check Google Cloud Console:**
   - Ensure OAuth client type is "Web application"
   - Client ID and secret match your configuration
   - Application is not disabled

**Access Denied:**
1. **Check OAuth Scopes:**
   ```env
   YOUTUBE_OAUTH_SCOPES=https://www.googleapis.com/auth/youtube,https://www.googleapis.com/auth/youtube.upload
   ```

2. **Verify Account Permissions:**
   - Account has YouTube channel
   - Account has content management permissions
   - Not using restricted/managed account

---

### Token Storage Issues

#### Symptoms
- `Token encryption failed`
- `Token not found` errors
- Frequent re-authentication required

#### Diagnosis
```bash
# Check token storage
ls -la tokens/
cat tokens/oauth_tokens.json  # Only if not encrypted

# Check encryption configuration
echo $OAUTH_ENCRYPTION_SECRET | wc -c  # Should be 32+ characters
```

#### Solutions

**Encryption Secret Issues:**
```bash
# Generate strong secret
openssl rand -base64 32

# Update environment
OAUTH_ENCRYPTION_SECRET=generated-secret-here
```

**Token File Permissions:**
```bash
# Secure token storage
chmod 700 tokens/
chmod 600 tokens/oauth_tokens.json
```

**Token Corruption:**
```bash
# Delete corrupted tokens
rm tokens/oauth_tokens.json

# Re-authenticate
You: Start the YouTube OAuth flow
```

## YouTube API Problems

### API Quota Issues

#### Symptoms
- `quotaExceeded` errors
- Slow or failed operations
- `Quota exceeded for quota metric` messages

#### Diagnosis
```bash
# Check quota usage in Google Cloud Console
# Navigate to: APIs & Services → YouTube Data API v3 → Quotas

You: Show current YouTube API quota usage
You: Check configuration for quota limits
```

#### Solutions

**Daily Quota Exceeded:**
1. **Wait for Reset:**
   - Quotas reset daily at midnight Pacific Time
   - Monitor usage in Google Cloud Console

2. **Optimize Operations:**
   ```bash
   # Use batch operations
   You: Organize videos using batch operations instead of individual calls

   # Reduce maxResults in list operations
   You: List 10 videos instead of 50 to save quota
   ```

3. **Request Quota Increase:**
   - Go to Google Cloud Console
   - Navigate to APIs & Services → YouTube Data API v3 → Quotas
   - Click "Edit Quotas" and request increase

**Rate Limiting:**
```env
# Adjust rate limits in configuration
YOUTUBE_RATE_LIMIT_RPS=50  # Reduce from 100
YOUTUBE_RATE_LIMIT_RPM=3000  # Reduce from 6000
```

---

### API Access Errors

#### Symptoms
- `API not enabled` errors
- `Invalid API key` errors
- `Insufficient permissions` errors

#### Diagnosis
```bash
# Test API access
You: List my YouTube videos  # Should work if API is properly configured
You: Check YouTube API configuration status
```

#### Solutions

**API Not Enabled:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Library
3. Search "YouTube Data API v3"
4. Click "Enable"
5. Wait 5-10 minutes for activation

**Permission Issues:**
1. **Check OAuth Scopes:**
   ```env
   YOUTUBE_OAUTH_SCOPES=https://www.googleapis.com/auth/youtube,https://www.googleapis.com/auth/youtube.upload
   ```

2. **Verify Account Access:**
   - Use account that owns/manages the YouTube channel
   - Check channel permissions in YouTube Studio

**Project Configuration:**
1. Ensure correct Google Cloud project is selected
2. Verify billing is enabled (required for API usage)
3. Check that quota limits are configured

## MCP Connection Issues

### Claude Desktop Integration

#### Symptoms
- Claude doesn't recognize YouTube tools
- "Server not available" messages
- Connection timeouts

#### Diagnosis
```bash
# Check Claude Desktop configuration
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Verify server executable
node dist/index.js --help

# Check if process is running
ps aux | grep "dist/index.js"
```

#### Solutions

**Configuration File Issues:**
```json
{
  "mcpServers": {
    "youtube-extended": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/Users/yourname/path/to/youtube_MetaData_MCP",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Path Issues:**
```bash
# Use absolute paths only
"cwd": "/Users/yourname/youtube_MetaData_MCP"  ✅
"cwd": "~/youtube_MetaData_MCP"                ❌
"cwd": "./youtube_MetaData_MCP"                ❌
```

**Process Issues:**
1. **Restart Claude Desktop completely:**
   - Quit Claude Desktop
   - Wait 10 seconds
   - Restart Claude Desktop

2. **Check for Process Conflicts:**
   ```bash
   # Kill any running instances
   pkill -f "dist/index.js"

   # Restart Claude Desktop
   ```

---

### MCP Protocol Issues

#### Symptoms
- Tool responses are malformed
- Intermittent connection drops
- Protocol version mismatches

#### Diagnosis
```bash
# Check MCP SDK version
npm list @modelcontextprotocol/sdk

# Test server directly
node dist/index.js
```

#### Solutions

**Version Compatibility:**
```bash
# Update MCP SDK
npm update @modelcontextprotocol/sdk

# Rebuild application
npm run build:basic
```

**Protocol Issues:**
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build:basic
```

## Metadata and Content Issues

### Metadata Generation Problems

#### Symptoms
- Empty or poor quality suggestions
- `No transcript available` errors
- Suggestion generation timeouts

#### Diagnosis
```bash
You: Check if video has transcript available
You: Generate metadata suggestions with debugging info
You: Verify video accessibility and permissions
```

#### Solutions

**No Transcript Available:**
1. **Enable Captions:**
   - Go to YouTube Studio
   - Select video → Details → Captions
   - Enable auto-generated captions or upload manual captions

2. **Alternative Analysis:**
   ```bash
   You: Generate metadata suggestions without transcript analysis
   ```

**Poor Quality Suggestions:**
1. **Improve Source Material:**
   - Add detailed video description
   - Use relevant tags
   - Ensure clear audio for auto-captions

2. **Manual Enhancement:**
   ```bash
   You: Generate suggestions then modify the title to be more specific
   ```

**Generation Timeouts:**
```env
# Increase timeout in configuration
METADATA_GENERATION_TIMEOUT_MS=60000
```

---

### Content Access Issues

#### Symptoms
- `Video not found` errors
- `Insufficient permissions` errors
- Private video access failures

#### Diagnosis
```bash
You: List my recent videos to verify access
You: Check video privacy status for specific video
```

#### Solutions

**Video Access:**
1. **Verify Ownership:**
   - Ensure you're authenticated with the channel owner account
   - Check that video exists and isn't deleted

2. **Privacy Settings:**
   - Private videos: Accessible to owner
   - Unlisted videos: Accessible to owner
   - Public videos: Accessible to everyone

**Permission Issues:**
```bash
# Re-authenticate with proper scopes
You: Start fresh OAuth flow with full permissions
```

## Batch Operation Problems

### Batch Job Failures

#### Symptoms
- Batches stuck in "running" status
- High failure rates in batch operations
- Incomplete batch execution

#### Diagnosis
```bash
You: Check detailed status of batch operation batch_123
You: Show failed operations and error details
```

#### Solutions

**Stuck Batches:**
1. **Check API Limits:**
   ```bash
   You: Verify current API quota usage
   ```

2. **Network Issues:**
   ```bash
   # Check connectivity
   ping googleapis.com
   ```

3. **Restart if Necessary:**
   ```bash
   # Cancel stuck batch (if feature available)
   You: Cancel batch operation batch_123

   # Restart with smaller batch size
   You: Process videos in smaller groups of 5 instead of 20
   ```

**High Failure Rates:**
1. **Analyze Failures:**
   ```bash
   You: Show error details for failed batch operations
   ```

2. **Common Fixes:**
   - Verify video accessibility
   - Check API quotas
   - Reduce batch size
   - Retry with exponential backoff

---

### Progress Monitoring Issues

#### Symptoms
- No progress updates
- Inaccurate progress reporting
- Missing batch status information

#### Diagnosis
```bash
You: Subscribe to batch status updates for real-time monitoring
You: Check if batch monitoring service is working
```

#### Solutions

**Enable Progress Monitoring:**
```bash
# Subscribe to updates
You: Subscribe to batch://status/batch_123 for live updates

# Manual status checks
You: Check batch status every minute until complete
```

**Fix Monitoring:**
```bash
# Restart batch monitoring
npm run dev:basic  # In development mode for verbose logging
```

## Performance Issues

### Slow Response Times

#### Symptoms
- Long delays for tool responses
- Timeout errors
- Claude Desktop becoming unresponsive

#### Diagnosis
```bash
# Check system resources
top
htop  # If available

# Monitor network
ping googleapis.com
```

#### Solutions

**Optimize Configuration:**
```env
# Reduce batch sizes
BATCH_MAX_CONCURRENT_OPERATIONS=3  # Down from 5

# Adjust rate limits
YOUTUBE_RATE_LIMIT_RPS=25  # Down from 100

# Increase timeouts
OPERATION_TIMEOUT_MS=60000  # Up from 30000
```

**System Optimization:**
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=2048"

# Close other applications
# Check available memory: free -m
```

---

### Memory Issues

#### Symptoms
- Out of memory errors
- Process crashes during large operations
- Gradual memory leaks

#### Diagnosis
```bash
# Monitor memory usage
ps aux | grep node
top -p $(pgrep node)
```

#### Solutions

**Increase Memory Allocation:**
```bash
# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

**Optimize Operations:**
```bash
# Process in smaller batches
You: Process 10 videos at a time instead of 50

# Clear operations between batches
You: Complete current batch before starting next one
```

## Error Message Reference

### Common Error Codes and Solutions

#### AUTH_REQUIRED
**Cause:** No valid authentication tokens
**Solution:** Run OAuth flow
```bash
You: Start the YouTube OAuth flow
```

#### QUOTA_EXCEEDED
**Cause:** YouTube API daily quota exceeded
**Solution:** Wait for reset or optimize usage
```bash
You: Check quota usage and wait until midnight PT for reset
```

#### VIDEO_NOT_FOUND
**Cause:** Video ID doesn't exist or insufficient permissions
**Solution:** Verify video exists and permissions
```bash
You: List my videos to confirm video ID is correct
```

#### GUARDRAILS_NOT_ACKNOWLEDGED
**Cause:** Metadata suggestions require explicit approval
**Solution:** Review and acknowledge guardrails
```bash
You: Apply metadata with acknowledgedGuardrails=true after review
```

#### INVALID_PARAMS
**Cause:** Required parameters missing or invalid
**Solution:** Check tool documentation and provide correct parameters

#### BATCH_NOT_FOUND
**Cause:** Batch ID doesn't exist or expired
**Solution:** Verify batch ID or start new batch operation

#### CONFIGURATION_ERROR
**Cause:** Invalid or missing configuration
**Solution:** Validate and fix configuration
```bash
npm run validate:env
```

## Advanced Debugging

### Enable Debug Logging

#### Development Mode
```bash
# Run in development mode with verbose logging
npm run dev:basic

# Enable debug mode
FEATURE_ENABLE_DEBUG_MODE=true
LOG_LEVEL=debug
```

#### Production Debugging
```env
# Enable file logging
ENABLE_FILE_LOGGING=true
LOG_DIR=logs

# Increase log level temporarily
LOG_LEVEL=debug
```

---

### Network Debugging

#### Test API Connectivity
```bash
# Test Google APIs
curl -v https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Test OAuth endpoints
curl -v https://accounts.google.com/oauth2/auth
```

#### Monitor Network Traffic
```bash
# Use network monitoring tools
sudo tcpdump -i any port 443
wireshark  # GUI option
```

---

### Configuration Debugging

#### Dump Current Configuration
```bash
You: Show complete configuration status with validation details
You: Display all feature flags and their current values
```

#### Test Individual Components
```bash
# Test OAuth configuration
npm run test:oauth

# Test YouTube API access
npm run test:youtube-api

# Test configuration validation
npm run validate:config
```

## Getting Additional Help

### Self-Service Resources

1. **Configuration Validator:**
   ```bash
   You: Run full configuration diagnostics
   You: Check for common setup issues
   ```

2. **Built-in Help:**
   ```bash
   You: Show help for metadata generation
   You: What troubleshooting options are available?
   ```

3. **Documentation:**
   - [Installation Guide](INSTALLATION.md)
   - [Configuration Guide](CONFIGURATION.md)
   - [User Guide](USER_GUIDE.md)
   - [Tools Reference](TOOLS_REFERENCE.md)

### Community Support

1. **GitHub Issues:**
   - Search existing issues: [GitHub Issues](https://github.com/denniswestermann/youtube_MetaData_MCP/issues)
   - Create new issue with:
     - Operating system and version
     - Node.js version
     - Complete error messages
     - Steps to reproduce
     - Configuration (without secrets)

2. **GitHub Discussions:**
   - General questions and workflows
   - Feature requests
   - Community troubleshooting

### Professional Support

**Email Support:** support@aiex-academy.com

Include in your request:
- Detailed problem description
- Error messages (full stack traces)
- System information
- Configuration details (redacted)
- Steps already attempted

### Creating Effective Bug Reports

#### Required Information

```
**Environment:**
- OS: macOS 13.0 / Windows 11 / Ubuntu 20.04
- Node.js: 20.5.0
- npm: 9.8.0
- YouTube MCP Extended: 0.0.2

**Configuration:**
- Authentication: OAuth configured
- Features enabled: [list enabled features]
- Custom settings: [any non-default settings]

**Problem:**
- What you expected to happen
- What actually happened
- Error messages (complete)
- Steps to reproduce

**Attempts:**
- Solutions already tried
- Workarounds that worked/didn't work
```

#### Helpful Debug Information

```bash
# System info
node --version
npm --version
cat package.json | grep version

# Configuration status
npm run validate:env
You: Show configuration validation results

# Recent logs (if file logging enabled)
tail -50 logs/youtube-mcp.log
```

---

**Still having issues?** The YouTube MCP Extended community is here to help. Use the resources above to get quick, effective support for your specific situation.