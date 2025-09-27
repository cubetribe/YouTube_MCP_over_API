# Installation Guide

This comprehensive guide walks you through installing and configuring YouTube MCP Extended with Claude Desktop.

## Table of Contents

- [Prerequisites](#prerequisites)
- [System Requirements](#system-requirements)
- [Step 1: Download and Install](#step-1-download-and-install)
- [Step 2: Google Cloud Console Setup](#step-2-google-cloud-console-setup)
- [Step 3: Environment Configuration](#step-3-environment-configuration)
- [Step 4: Claude Desktop Configuration](#step-4-claude-desktop-configuration)
- [Step 5: First Run and Verification](#step-5-first-run-and-verification)
- [Common Installation Issues](#common-installation-issues)
- [Platform-Specific Instructions](#platform-specific-instructions)
- [Verification Checklist](#verification-checklist)

## Prerequisites

Before starting, ensure you have:

### Required Software
- **Node.js 20.0.0 or higher** - [Download from nodejs.org](https://nodejs.org/)
- **Claude Desktop** - [Download from claude.ai](https://claude.ai/download)
- **Git** (optional but recommended) - [Download from git-scm.com](https://git-scm.com/)

### Required Accounts
- **Google Account** with access to [Google Cloud Console](https://console.cloud.google.com/)
- **YouTube Channel** (the account must own or manage a YouTube channel)

### Knowledge Requirements
- Basic command line usage
- Basic understanding of environment variables
- YouTube channel management permissions

## System Requirements

### Minimum Requirements
- **OS**: macOS 10.15+, Windows 10+, or Linux Ubuntu 18.04+
- **RAM**: 512MB available memory
- **Storage**: 500MB free disk space
- **Network**: Stable internet connection

### Recommended Requirements
- **RAM**: 1GB available memory
- **Storage**: 2GB free disk space (for backups and logs)
- **CPU**: Modern multi-core processor for better performance

## Step 1: Download and Install

### Option A: Clone from GitHub (Recommended)

```bash
# Clone the repository
git clone https://github.com/denniswestermann/youtube_MetaData_MCP.git

# Navigate to the project directory
cd youtube_MetaData_MCP

# Install dependencies
npm install

# Build the project
npm run build:basic
```

### Option B: Download ZIP Archive

1. Go to [GitHub repository](https://github.com/denniswestermann/youtube_MetaData_MCP)
2. Click "Code" → "Download ZIP"
3. Extract the archive to your desired location
4. Open terminal/command prompt in the extracted folder
5. Run the installation commands:

```bash
npm install
npm run build:basic
```

### Verify Installation

Check that the build completed successfully:

```bash
# Verify build artifacts exist
ls dist/

# You should see files like:
# index.js
# auth/
# youtube/
# (and other directories)
```

## Step 2: Google Cloud Console Setup

This is the most critical step. Follow these instructions carefully.

### Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit [console.cloud.google.com](https://console.cloud.google.com/)
   - Sign in with your Google account

2. **Create a New Project**
   - Click "Select a project" at the top
   - Click "New Project"
   - Enter project name: `YouTube MCP Extended`
   - Click "Create"

3. **Wait for Project Creation**
   - This may take a minute or two
   - You'll see a notification when complete

### Enable YouTube Data API v3

1. **Navigate to APIs & Services**
   - In the left sidebar, click "APIs & Services" → "Library"

2. **Search for YouTube API**
   - In the search box, type "YouTube Data API v3"
   - Click on "YouTube Data API v3" from the results

3. **Enable the API**
   - Click the "Enable" button
   - Wait for activation (usually takes 30-60 seconds)

### Create OAuth 2.0 Credentials

1. **Go to Credentials Page**
   - In the left sidebar, click "APIs & Services" → "Credentials"

2. **Configure OAuth Consent Screen** (if not done already)
   - Click "OAuth consent screen"
   - Choose "External" (unless you have a Google Workspace account)
   - Fill in required fields:
     - App name: `YouTube MCP Extended`
     - User support email: Your email
     - Developer contact: Your email
   - Click "Save and Continue"
   - Add scopes: Click "Add or Remove Scopes"
     - Add: `../auth/youtube`
     - Add: `../auth/youtube.upload`
   - Click "Save and Continue"
   - Add test users (your Google account email)
   - Click "Save and Continue"

3. **Create OAuth Client**
   - Go back to "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Name: `YouTube MCP Extended Client`
   - Authorized redirect URIs: Click "Add URI"
     - Add: `http://localhost:3000/callback`
   - Click "Create"

4. **Save Credentials**
   - Copy the "Client ID" (ends with `.apps.googleusercontent.com`)
   - Copy the "Client Secret"
   - Keep these safe - you'll need them in the next step

### Important Notes

- **Redirect URI**: Must be exactly `http://localhost:3000/callback`
- **Testing Mode**: Your app will start in testing mode (max 100 users)
- **Production**: To publish later, you'll need to complete verification
- **Scopes**: We only request necessary YouTube permissions

## Step 3: Environment Configuration

### Create Environment File

1. **Copy the Example File**
   ```bash
   cp .env.example .env
   ```

2. **Edit the .env File**
   Open `.env` in your text editor and configure:

   ```env
   # Required OAuth Configuration
   YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   YOUTUBE_CLIENT_SECRET=your-client-secret
   YOUTUBE_REDIRECT_URI=http://localhost:3000/callback

   # Security (Highly Recommended)
   OAUTH_ENCRYPTION_SECRET=your-very-strong-secret-here

   # Optional: Environment
   NODE_ENV=production
   LOG_LEVEL=info
   ```

### Generate Strong Encryption Secret

For production use, generate a strong encryption secret:

```bash
# On macOS/Linux:
openssl rand -base64 32

# On Windows (PowerShell):
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Alternative: Use an online generator
# Visit: https://generate-random.org/encryption-key-generator
```

### Validate Configuration

Test your configuration:

```bash
# Check if all required variables are set
npm run validate:env

# This should show green checkmarks for all required settings
```

## Step 4: Claude Desktop Configuration

### Locate Claude Desktop Config File

The location depends on your operating system:

#### macOS
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

#### Windows
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

#### Linux
```bash
~/.config/Claude/claude_desktop_config.json
```

### Update Configuration File

1. **Open the config file** in your text editor
2. **Add the MCP server configuration**:

```json
{
  "mcpServers": {
    "youtube-extended": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/absolute/path/to/youtube_MetaData_MCP",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

3. **Update the path**: Replace `/absolute/path/to/youtube_MetaData_MCP` with the full path to your installation

### Get Absolute Path

To find your absolute path:

#### macOS/Linux
```bash
cd youtube_MetaData_MCP
pwd
# Copy the output
```

#### Windows (Command Prompt)
```cmd
cd youtube_MetaData_MCP
cd
# Copy the output
```

#### Windows (PowerShell)
```powershell
cd youtube_MetaData_MCP
Get-Location
# Copy the output
```

### Example Complete Configuration

```json
{
  "mcpServers": {
    "youtube-extended": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/Users/yourname/Documents/youtube_MetaData_MCP",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Step 5: First Run and Verification

### Restart Claude Desktop

1. **Quit Claude Desktop completely**
   - On macOS: Claude → Quit Claude
   - On Windows: Right-click system tray → Exit

2. **Wait 10 seconds** (important for clean restart)

3. **Launch Claude Desktop again**

### Test the Connection

1. **Open a new chat in Claude Desktop**

2. **Test MCP connection**:
   ```
   You: Can you check if the YouTube MCP server is available?
   ```

3. **Claude should respond** with information about available YouTube tools

### Complete OAuth Authentication

1. **Start OAuth flow**:
   ```
   You: Start the YouTube OAuth flow
   ```

2. **Follow the instructions**:
   - Claude will provide an authorization URL
   - Open the URL in your browser
   - Sign in to Google
   - Grant permissions to the app
   - Copy the `code` and `state` from the redirect URL

3. **Complete authentication**:
   ```
   You: Complete the OAuth flow with code: [paste code] and state: [paste state]
   ```

### Verify Functionality

1. **List your videos**:
   ```
   You: List my recent YouTube videos
   ```

2. **Check configuration**:
   ```
   You: Show me the YouTube MCP configuration status
   ```

If everything works, you'll see your video data and configuration status.

## Common Installation Issues

### Node.js Version Issues

**Problem**: `Error: Node.js version 20.0.0 or higher required`

**Solution**:
```bash
# Check current version
node --version

# Update Node.js from nodejs.org
# Or use a version manager like nvm:
nvm install 20
nvm use 20
```

### Permission Errors

**Problem**: `EACCES` permission errors during npm install

**Solution** (macOS/Linux):
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use nvm instead of system Node.js
```

**Solution** (Windows):
```cmd
# Run Command Prompt as Administrator
# Then run npm install
```

### Build Failures

**Problem**: TypeScript compilation errors

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Check TypeScript version
npx tsc --version

# Manual type checking
npm run type-check
```

### OAuth Redirect URI Mismatch

**Problem**: `redirect_uri_mismatch` error

**Solution**:
1. Check Google Cloud Console OAuth client settings
2. Ensure redirect URI is exactly: `http://localhost:3000/callback`
3. No trailing slash, no HTTPS, exact case match

### Claude Desktop Config Issues

**Problem**: Claude doesn't see the MCP server

**Solution**:
1. Verify config file location and syntax
2. Use absolute paths (not relative)
3. Check that `dist/index.js` exists
4. Restart Claude Desktop completely
5. Check Claude Desktop logs (if accessible)

### YouTube API Not Enabled

**Problem**: `YouTube Data API has not been used in project`

**Solution**:
1. Go to Google Cloud Console
2. Navigate to "APIs & Services" → "Library"
3. Search for "YouTube Data API v3"
4. Click "Enable"
5. Wait 5-10 minutes for activation

## Platform-Specific Instructions

### macOS Specific

#### Using Homebrew
```bash
# Install Node.js via Homebrew
brew install node@20

# Verify installation
node --version
npm --version
```

#### Xcode Command Line Tools
Some npm packages require compilation:
```bash
xcode-select --install
```

### Windows Specific

#### Using Chocolatey
```powershell
# Install Node.js via Chocolatey (run as Administrator)
choco install nodejs

# Verify installation
node --version
npm --version
```

#### Windows Build Tools
Some npm packages require compilation:
```cmd
npm install -g windows-build-tools
```

### Linux Specific

#### Ubuntu/Debian
```bash
# Install Node.js via NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### Build Dependencies
```bash
# Install build tools
sudo apt-get install build-essential
```

## Verification Checklist

Use this checklist to ensure proper installation:

### ✅ Prerequisites
- [ ] Node.js 20+ installed (`node --version`)
- [ ] Claude Desktop installed and running
- [ ] Google account with YouTube channel access
- [ ] Google Cloud Console project created

### ✅ Installation
- [ ] Repository cloned/downloaded
- [ ] Dependencies installed (`npm install` completed)
- [ ] Project built successfully (`npm run build:basic`)
- [ ] `dist/` directory contains compiled files

### ✅ Google Cloud Setup
- [ ] YouTube Data API v3 enabled
- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 client created
- [ ] Redirect URI set to `http://localhost:3000/callback`
- [ ] Client ID and Secret copied

### ✅ Environment Configuration
- [ ] `.env` file created from template
- [ ] `YOUTUBE_CLIENT_ID` set correctly
- [ ] `YOUTUBE_CLIENT_SECRET` set correctly
- [ ] `OAUTH_ENCRYPTION_SECRET` generated and set
- [ ] Configuration validated (`npm run validate:env`)

### ✅ Claude Desktop Configuration
- [ ] Config file location identified
- [ ] MCP server added to configuration
- [ ] Absolute path to project used
- [ ] Claude Desktop restarted

### ✅ Functionality Testing
- [ ] Claude Desktop recognizes MCP server
- [ ] OAuth flow completes successfully
- [ ] Video listing works
- [ ] Configuration status shows no errors

### ✅ Security
- [ ] Strong encryption secret generated
- [ ] OAuth tokens encrypted in storage
- [ ] No credentials committed to git
- [ ] File permissions appropriate

## Next Steps

Once installation is complete:

1. **Read the [User Guide](USER_GUIDE.md)** to learn about features
2. **Review [Configuration Guide](CONFIGURATION.md)** for advanced settings
3. **Check [Tools Reference](TOOLS_REFERENCE.md)** for complete API documentation
4. **Keep [Troubleshooting Guide](TROUBLESHOOTING.md)** handy for issues

## Getting Help

If you encounter issues:

1. **Check the [Troubleshooting Guide](TROUBLESHOOTING.md)**
2. **Search [GitHub Issues](https://github.com/denniswestermann/youtube_MetaData_MCP/issues)**
3. **Create a new issue** with:
   - Your operating system
   - Node.js version
   - Error messages
   - Steps to reproduce

## Security Notes

- Never commit your `.env` file to version control
- Use strong, unique encryption secrets
- Regularly rotate OAuth credentials
- Monitor API usage in Google Cloud Console
- Keep the application updated to latest version

---

**Installation complete!** You're ready to start managing your YouTube channel with Claude Desktop and YouTube MCP Extended.