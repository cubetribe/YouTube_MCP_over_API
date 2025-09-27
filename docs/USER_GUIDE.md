# User Guide

Welcome to YouTube MCP Extended! This comprehensive guide walks you through all features and capabilities, from basic video management to advanced automation workflows.

## Table of Contents

- [Getting Started](#getting-started)
- [Core Features](#core-features)
- [OAuth Authentication](#oauth-authentication)
- [Video Management](#video-management)
- [Metadata Optimization](#metadata-optimization)
- [Video Scheduling](#video-scheduling)
- [Playlist Management](#playlist-management)
- [Backup and Restore](#backup-and-restore)
- [Batch Operations](#batch-operations)
- [Advanced Features](#advanced-features)
- [Tips and Best Practices](#tips-and-best-practices)
- [Workflow Examples](#workflow-examples)

## Getting Started

### First Steps

After installation and configuration, start by authenticating with YouTube:

```
You: Start the YouTube OAuth flow
Claude: [Provides authorization URL and instructions]

You: Complete the OAuth flow with code: [your-code] and state: [your-state]
Claude: [Confirms successful authentication]
```

### Basic Health Check

Verify everything is working:

```
You: Check the YouTube MCP configuration status
Claude: [Shows configuration status and validation results]

You: List my recent YouTube videos
Claude: [Displays your recent videos with metadata]
```

## Core Features

### Overview of Capabilities

YouTube MCP Extended provides these main feature areas:

1. **🔐 Authentication** - Secure OAuth integration
2. **📹 Video Management** - List, analyze, and manage videos
3. **🏷️ Metadata Optimization** - AI-powered content enhancement
4. **📅 Scheduling** - Strategic release timing
5. **📋 Playlists** - Automated organization
6. **💾 Backups** - Data protection and recovery
7. **⚡ Batch Operations** - Bulk processing

## OAuth Authentication

### Initial Setup

The OAuth flow connects your YouTube channel securely:

#### Step 1: Start Authentication

```
You: Start the YouTube OAuth flow
```

Claude responds with:
- Authorization URL
- State parameter for security
- Instructions for browser flow

#### Step 2: Browser Authorization

1. Open the provided URL in your browser
2. Sign in to Google with your YouTube account
3. Review and grant permissions
4. You'll be redirected to a callback URL
5. Copy the `code` and `state` from the URL

#### Step 3: Complete Authentication

```
You: Complete the OAuth flow with code: ABC123... and state: DEF456...
```

### Managing Authentication

#### Check Authentication Status

```
You: Show me my YouTube channel information
```

#### Re-authenticate if Needed

```
You: The OAuth tokens seem expired. How do I re-authenticate?
```

#### Revoke Access

To revoke access, delete the tokens file:
```bash
rm tokens/oauth_tokens.json
```

## Video Management

### Listing Videos

#### Basic Video List

```
You: List my recent YouTube videos
```

#### Filtered Lists

```
You: List my last 10 videos
You: List videos from the past month
You: Show me videos with specific keywords in the title
```

#### Detailed Video Information

```
You: Get detailed information for video ID: ABC123XYZ
```

### Video Analysis

#### Transcript Access

```
You: Get the transcript for my latest video
You: Download transcripts for these video IDs: [ABC123, DEF456]
```

#### Content Analysis

```
You: Analyze the content and performance potential of video ABC123
```

### Video Metadata Viewing

#### Current Metadata

```
You: Show me the current metadata for video ABC123
```

Response includes:
- Title and description
- Tags and category
- Privacy status
- Publication date
- View count and engagement

## Metadata Optimization

### AI-Powered Suggestions

#### Generate Suggestions

```
You: Generate metadata suggestions for video ABC123 including transcript analysis
```

The system will:
1. Analyze video content
2. Review transcripts (if available)
3. Generate optimized title, description, and tags
4. Create a review checklist
5. Provide guardrail recommendations

#### Review Process

After generating suggestions, you'll receive:

**Suggested Metadata:**
- Optimized title
- Enhanced description
- Relevant tags
- Category recommendations

**Guardrails:**
- Content appropriateness checks
- Brand consistency validation
- SEO optimization notes
- Compliance considerations

**Review Checklist:**
- [ ] Title is engaging and accurate
- [ ] Description provides value
- [ ] Tags are relevant and searchable
- [ ] No misleading claims
- [ ] Appropriate for target audience

### Applying Metadata

#### Standard Application

```
You: Apply the metadata suggestions for video ABC123 after reviewing the checklist
```

#### Custom Modifications

```
You: Apply metadata suggestions for video ABC123 but change the title to "My Custom Title"
```

#### Batch Metadata Updates

```
You: Generate and apply metadata suggestions for these videos: [ABC123, DEF456, GHI789]
```

### Metadata Safety Features

#### Automatic Backups

Before any metadata change:
- Original metadata is backed up
- Timestamp recorded
- Restore option available

#### Guardrail System

The system prevents:
- Inappropriate content suggestions
- Misleading titles or descriptions
- Over-optimization that hurts readability
- Brand inconsistencies

#### Review Requirements

Certain changes require explicit approval:
- Major title changes
- Category modifications
- Privacy status changes
- Sensitive content areas

## Video Scheduling

### Planning Release Strategy

#### Basic Scheduling

```
You: Create a release schedule for these videos over the next month
```

#### Advanced Scheduling

```
You: Schedule these 10 videos with optimal timing for maximum engagement, considering my audience timezone
```

### Scheduling Parameters

#### Time-Based Scheduling

```
You: Schedule videos every Tuesday and Thursday at 3 PM PST
```

#### Intelligent Spacing

```
You: Schedule these videos with intelligent spacing to avoid audience fatigue
```

#### Category-Based Timing

```
You: Schedule educational videos on weekdays and entertainment videos on weekends
```

### Schedule Management

#### Preview Schedules

```
You: Show me a preview of the proposed schedule before applying it
```

#### Apply Schedules

```
You: Apply the schedule and start the batch process
```

#### Monitor Progress

```
You: Check the status of the scheduling batch operation
```

## Playlist Management

### Automatic Organization

#### Category-Based Organization

```
You: Organize my recent videos into playlists based on their categories
```

#### Custom Organization Rules

```
You: Create playlists for my cooking videos: "Appetizers", "Main Courses", and "Desserts"
```

### Manual Playlist Creation

#### Create New Playlist

```
You: Create a new playlist called "Tutorial Series" with description "Step-by-step tutorials for beginners"
```

#### Add Videos to Existing Playlist

```
You: Add these videos to my "Tutorial Series" playlist: [ABC123, DEF456]
```

### Playlist Optimization

#### Intelligent Ordering

```
You: Reorder my "Tutorial Series" playlist in logical learning progression
```

#### Playlist Metadata

```
You: Optimize the title and description for my "Tutorial Series" playlist
```

### Bulk Playlist Operations

#### Mass Organization

```
You: Organize all my videos from the past year into topic-based playlists
```

#### Position Management

```
You: Add these videos to the playlist at specific positions for optimal flow
```

## Backup and Restore

### Creating Backups

#### Manual Backups

```
You: Create a backup of metadata for all my videos
You: Backup metadata for these specific videos: [ABC123, DEF456]
```

#### Automatic Backups

Backups are automatically created:
- Before metadata changes
- Before bulk operations
- Before scheduling updates

### Managing Backups

#### List Available Backups

```
You: Show me all available metadata backups
```

#### Backup Details

```
You: Show me details for the backup created on 2024-01-15
```

### Restoring from Backups

#### Single Video Restore

```
You: Restore video ABC123 metadata from the backup created on 2024-01-15
```

#### Bulk Restore

```
You: Restore metadata for all videos from the January 15th backup
```

### Backup Best Practices

- Backups are organized by date
- Include original timestamps
- Preserve all metadata fields
- Enable easy comparison between versions

## Batch Operations

### Understanding Batch Processing

Batch operations handle multiple actions efficiently:
- Respect YouTube API rate limits
- Provide real-time progress updates
- Handle errors gracefully
- Allow monitoring and cancellation

### Starting Batch Operations

#### Batch Scheduling

```
You: Schedule these 20 videos with batch processing
```

#### Batch Playlist Management

```
You: Add these 50 videos to various playlists using batch operations
```

#### Batch Metadata Updates

```
You: Apply metadata suggestions to these 15 videos in batch mode
```

### Monitoring Batch Progress

#### Real-Time Updates

```
You: Subscribe to batch status updates for batch ID: batch_123
```

#### Check Status

```
You: Check the current status of batch operation batch_123
```

#### Detailed Progress

```
You: Show me detailed progress including successes and failures for batch_123
```

### Batch Error Handling

#### Partial Success

Batches continue even if individual operations fail:
- Successful operations complete
- Failed operations are logged
- Detailed error reporting provided
- Retry options available

#### Error Resolution

```
You: Show me the failed operations from batch_123 and help me resolve them
```

## Advanced Features

### Thumbnail Concepts

#### Generate Thumbnail Ideas

```
You: Generate thumbnail concept suggestions for video ABC123 based on content and transcript
```

#### Thumbnail Strategy

```
You: Create a cohesive thumbnail strategy for my video series
```

### Transcript Analysis

#### Content Insights

```
You: Analyze the transcript of video ABC123 for key topics and engagement points
```

#### Optimization Opportunities

```
You: Identify optimization opportunities based on transcript analysis
```

### Quota Management

#### Monitor API Usage

```
You: Show me my current YouTube API quota usage
```

#### Optimize Operations

```
You: Plan these operations to minimize API quota usage
```

### Performance Metrics

#### Track Changes

```
You: Track the performance impact of recent metadata changes
```

#### Optimization Analysis

```
You: Analyze which optimization strategies are most effective for my channel
```

## Tips and Best Practices

### Content Strategy

#### Metadata Optimization

- **Use transcript analysis** for better keyword suggestions
- **Review all suggestions** before applying
- **Test different approaches** with A/B testing mindset
- **Maintain brand consistency** across all content

#### Scheduling Strategy

- **Analyze audience timezone** for optimal posting times
- **Space content appropriately** to avoid fatigue
- **Consider content type** when timing releases
- **Use preview mode** before applying schedules

### Operational Efficiency

#### Batch Operations

- **Group similar operations** for efficiency
- **Monitor progress actively** during large batches
- **Plan around API quotas** for large operations
- **Use backup features** before major changes

#### Safety Practices

- **Always backup** before significant changes
- **Review guardrails carefully** before applying suggestions
- **Test on less important videos** first
- **Keep backups organized** by date and purpose

### Channel Management

#### Playlist Organization

- **Create logical hierarchies** for better navigation
- **Use consistent naming** across playlists
- **Optimize playlist metadata** for discovery
- **Regular maintenance** to keep current

#### Content Planning

- **Plan releases strategically** around events and seasons
- **Maintain content variety** in scheduling
- **Use analytics insights** to inform decisions
- **Regular optimization reviews** for improvement

## Workflow Examples

### New Channel Setup

1. **Authenticate**: Set up OAuth connection
2. **Audit Content**: List and analyze existing videos
3. **Organize Structure**: Create logical playlist hierarchy
4. **Optimize Metadata**: Generate and apply suggestions
5. **Plan Schedule**: Create strategic release calendar

### Content Creator Workflow

#### Weekly Optimization Routine

```
You: List videos uploaded this week
You: Generate metadata suggestions for this week's videos
You: Review and apply suggestions after checking guardrails
You: Create backup before any changes
You: Update playlists with new content
```

#### Monthly Strategy Review

```
You: Analyze performance of recent metadata changes
You: Review and optimize playlist organization
You: Plan next month's release schedule
You: Create comprehensive backup of all metadata
```

### Educational Institution Workflow

#### Course Launch Preparation

```
You: Create playlist structure for new course
You: Generate educational metadata for course videos
You: Schedule release aligned with academic calendar
You: Ensure consistent branding across all content
```

#### Semester Maintenance

```
You: Update playlist descriptions with semester information
You: Optimize video metadata for better searchability
You: Create archives of previous semester content
You: Plan content releases for upcoming semester
```

### Marketing Campaign Workflow

#### Campaign Launch

```
You: Schedule product launch videos with coordinated timing
You: Create themed playlists for campaign content
You: Optimize metadata for campaign keywords
You: Monitor batch operations for timely execution
```

#### Performance Optimization

```
You: Analyze engagement patterns from campaign videos
You: Optimize underperforming content metadata
You: Adjust future campaign scheduling based on insights
You: Create performance report backups for analysis
```

## Troubleshooting Common Scenarios

### Metadata Issues

#### Suggestions Not Generated

1. Check if video has description or transcript
2. Verify video is accessible
3. Ensure sufficient API quota available

#### Guardrails Failing

1. Review checklist items carefully
2. Modify suggestions if needed
3. Acknowledge guardrails explicitly

### Scheduling Problems

#### Schedule Conflicts

1. Review proposed schedule for overlaps
2. Adjust timing parameters
3. Use preview mode to validate

#### Failed Scheduling

1. Check API quota availability
2. Verify video privacy settings
3. Monitor batch operation status

### Playlist Management

#### Organization Failures

1. Verify playlist permissions
2. Check for category mapping issues
3. Review video accessibility

#### Adding Videos Failed

1. Check video exists and is accessible
2. Verify playlist privacy settings
3. Ensure proper permissions

## Getting Help

### Built-in Help

```
You: Show me help for metadata optimization
You: What tools are available for video scheduling?
You: How do I troubleshoot batch operations?
```

### Configuration Diagnostics

```
You: Run configuration diagnostics
You: Validate my current setup
You: Check for common configuration issues
```

### Community Resources

- **Documentation**: Complete guides in `/docs`
- **GitHub Issues**: Report bugs and request features
- **Discussions**: Share workflows and get help
- **Email Support**: Direct assistance for complex issues

## Next Steps

Now that you understand the features:

1. **Start small**: Try basic metadata optimization
2. **Experiment safely**: Use preview modes and backups
3. **Scale gradually**: Move to batch operations as you're comfortable
4. **Optimize continuously**: Regular reviews and improvements
5. **Share insights**: Contribute to community knowledge

---

**Master YouTube management with Claude!** Use this guide as your reference for creating efficient, effective workflows that save time and improve your channel's performance.