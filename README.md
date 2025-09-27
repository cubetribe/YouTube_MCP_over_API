# YouTube MCP Extended

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0.0-purple.svg)](https://modelcontextprotocol.io/)

> A powerful Model Context Protocol (MCP) server that transforms Claude Desktop into your personal YouTube channel management assistant. Automate metadata optimization, video scheduling, playlist organization, and content backups with AI-powered insights.

## What is YouTube MCP Extended?

YouTube MCP Extended is a comprehensive MCP server that enables Claude Desktop to manage your YouTube channel with professional-grade automation tools. Whether you're a content creator with dozens of videos or a digital marketer managing multiple channels, this tool streamlines your workflow with intelligent automation and safety guardrails.

### Key Benefits

- **🤖 AI-Powered Metadata**: Generate optimized titles, descriptions, and tags using your video content and transcripts
- **📅 Smart Scheduling**: Plan video releases with intelligent timing strategies
- **📋 Playlist Automation**: Organize videos into playlists automatically by category or custom rules
- **💾 Safe Operations**: Built-in backup system and approval workflows prevent accidental changes
- **⚡ Batch Processing**: Handle multiple videos efficiently with progress tracking
- **🔒 Secure**: OAuth authentication with optional encrypted token storage

## Quick Start (5 Minutes)

### Prerequisites

- **Node.js 20+** ([Download](https://nodejs.org/))
- **Claude Desktop** ([Download](https://claude.ai/download))
- **Google Cloud Project** with YouTube Data API v3 enabled

### 1. Installation

```bash
# Clone and install
git clone https://github.com/denniswestermann/youtube_MetaData_MCP.git
cd youtube_MetaData_MCP
npm install
npm run build:basic
```

### 2. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **YouTube Data API v3**
4. Create **OAuth 2.0 credentials** (Web application type)
5. Add `http://localhost:3000/callback` to authorized redirect URIs
6. Copy your Client ID and Client Secret

### 3. Configuration

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your-client-secret
OAUTH_ENCRYPTION_SECRET=your-strong-encryption-secret
```

### 4. Claude Desktop Configuration

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "youtube-extended": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/path/to/youtube_MetaData_MCP"
    }
  }
}
```

### 5. First Use

1. Restart Claude Desktop
2. Ask Claude: "Start the YouTube OAuth flow"
3. Follow the authentication instructions
4. Ask Claude: "List my recent videos"

🎉 **You're ready!** Claude can now manage your YouTube channel.

## Core Features

### 🔐 OAuth Authentication
- Secure PKCE-based OAuth 2.0 flow
- Encrypted token storage (optional)
- Automatic token refresh
- One-time setup per machine

### 📹 Video Management
- List and analyze video metadata
- Download transcripts for analysis
- Bulk operations with progress tracking
- Smart metadata suggestions

### 🏷️ Metadata Optimization
- AI-powered title and description generation
- Intelligent tag suggestions based on content
- Guardrail system prevents problematic changes
- Review workflow with approval checklists

### 📅 Video Scheduling
- Strategic release timing optimization
- Bulk scheduling with conflict detection
- Preview mode for planning
- Timezone-aware scheduling

### 📋 Playlist Management
- Automatic categorization by YouTube categories
- Custom playlist organization rules
- Bulk video assignment
- Position-specific placement

### 💾 Backup & Recovery
- Automatic metadata backups before changes
- Date-organized backup storage
- One-click restore functionality
- Version history tracking

### ⚡ Batch Operations
- Queue-based processing for API efficiency
- Real-time progress monitoring
- Error handling with partial success
- Resource subscriptions for live updates

## User Personas & Use Cases

### 🎥 Content Creator
*"I need to optimize 50+ video titles and organize them into themed playlists"*

- Generate engaging titles from video transcripts
- Bulk organize videos into series playlists
- Schedule optimal release times
- Backup metadata before experimentation

### 📈 Digital Marketer
*"I manage multiple client channels and need consistent optimization"*

- Standardize metadata across channels
- Implement release scheduling strategies
- Generate performance-optimized descriptions
- Track changes with audit trails

### 🎓 Educational Institution
*"Our course library needs better organization and discoverability"*

- Organize videos by course/module structure
- Generate educational descriptions and tags
- Schedule semester-based releases
- Maintain consistent categorization

### 🛠️ Developer/Agency
*"I want to extend the tool for custom workflows"*

- Built-in configuration validation
- Feature flag system for controlled rollouts
- Comprehensive error handling
- Extensible architecture

## Safety & Guardrails

YouTube MCP Extended prioritizes safe operations:

- **Approval Workflows**: Metadata changes require explicit confirmation
- **Automatic Backups**: Original data preserved before modifications
- **Preview Mode**: See changes before applying them
- **Error Recovery**: Graceful handling of API failures
- **Rate Limiting**: Respects YouTube API quotas and limits

## Architecture Highlights

- **Modular Design**: Clean separation of concerns
- **MCP Protocol**: Native integration with Claude Desktop
- **TypeScript**: Full type safety and IDE support
- **Configuration System**: Environment-based setup with validation
- **Batch Processing**: Efficient API usage with progress tracking
- **Resource Subscriptions**: Real-time updates for long operations

## Documentation

- 📖 [Installation Guide](docs/INSTALLATION.md) - Detailed setup instructions
- ⚙️ [Configuration Guide](docs/CONFIGURATION.md) - Complete configuration reference
- 👤 [User Guide](docs/USER_GUIDE.md) - Feature walkthroughs and tutorials
- 🔧 [Tools Reference](docs/TOOLS_REFERENCE.md) - Complete MCP tools documentation
- 🚨 [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

## Example Workflows

### Optimizing Video Metadata
```
You: "Generate metadata suggestions for my latest video about TypeScript"
Claude: [Analyzes transcript, generates optimized title, description, tags]
You: "Apply the suggestions after reviewing the checklist"
Claude: [Creates backup, applies changes, confirms success]
```

### Bulk Playlist Organization
```
You: "Organize my last 20 videos into playlists by topic"
Claude: [Analyzes categories, creates themed playlists, assigns videos]
You: "Monitor the progress"
Claude: [Shows real-time batch progress with success/failure details]
```

### Strategic Scheduling
```
You: "Schedule my next 10 videos for optimal engagement"
Claude: [Analyzes upload patterns, creates strategic schedule]
You: "Apply the schedule"
Claude: [Implements scheduling with batch tracking]
```

## Development & Contribution

### Development Commands

```bash
# Development with hot reload
npm run dev:basic

# Build for production
npm run build:basic

# Run tests
npm test

# Lint and format
npm run lint
npm run format

# Type checking
npm run type-check
```

### Project Structure

```
src/
├── auth/           # OAuth authentication
├── youtube/        # YouTube API client
├── metadata/       # Metadata generation & review
├── scheduler/      # Video scheduling
├── playlist/       # Playlist management
├── backup/         # Backup & restore
├── batch/          # Batch processing
└── config/         # Configuration system
```

## System Requirements

- **Node.js**: 20.0.0 or higher
- **Memory**: 512MB minimum, 1GB recommended
- **Storage**: 100MB for application, additional space for backups
- **Network**: Stable internet connection for YouTube API
- **Platform**: macOS, Windows, or Linux

## API Quotas & Limits

YouTube Data API v3 provides 10,000 quota units per day by default:

- **List videos**: 1 unit per request
- **Update metadata**: 50 units per update
- **Create playlist**: 50 units
- **Add to playlist**: 50 units

The server includes intelligent quota monitoring and rate limiting.

## Security Considerations

- **Token Encryption**: Use `OAUTH_ENCRYPTION_SECRET` for production
- **Scope Limitation**: Request only necessary YouTube permissions
- **Local Storage**: All data stays on your machine
- **Network Security**: Direct communication with YouTube APIs only
- **Audit Trail**: Optional logging for compliance requirements

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| OAuth fails | Check redirect URI matches Google Cloud Console |
| API quota exceeded | Monitor usage in Google Cloud Console |
| Metadata suggestions empty | Ensure video has description or transcript |
| Batch jobs stuck | Check network connection and API quotas |
| Claude can't find server | Verify `claude_desktop_config.json` path |

## Version History

- **v0.0.2** - Enhanced documentation and user experience
- **v0.0.1** - Initial release with core MCP functionality

## Support & Community

- 📖 **Documentation**: Comprehensive guides in `/docs`
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/denniswestermann/youtube_MetaData_MCP/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/denniswestermann/youtube_MetaData_MCP/discussions)
- 📧 **Email**: support@aiex-academy.com

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

Built with:
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) - MCP implementation
- [Google APIs Client](https://github.com/googleapis/google-api-nodejs-client) - YouTube API access
- [Google Auth Library](https://github.com/googleapis/google-auth-library-nodejs) - OAuth authentication

---

**Ready to supercharge your YouTube workflow?** Follow the Quick Start guide above and transform Claude Desktop into your personal YouTube management assistant.