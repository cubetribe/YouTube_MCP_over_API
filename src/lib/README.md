# Monitoring and Logging System

This directory contains the comprehensive monitoring and logging system for YouTube MCP Extended.

## Components

### Core Logging (`logger.ts`)
Enhanced structured logger with categories, file rotation, and MCP compliance.

```typescript
import { logger } from './logger.js';

logger.info('Operation completed', 'api', {
  operation: 'videos.list',
  duration: 245,
  correlationId: 'req_123'
});
```

### Performance Monitoring (`performance-monitor.ts`)
Tracks API operation timing and success rates.

```typescript
import { performanceMonitor } from './performance-monitor.js';

const result = await performanceMonitor.wrapOperation(
  { operationType: 'videos.update', correlationId: 'req_123' },
  () => apiCall()
);
```

### Quota Monitoring (`quota-monitor.ts`)
Monitors YouTube API quota usage and rate limiting.

```typescript
import { quotaMonitor } from './quota-monitor.js';

quotaMonitor.recordQuotaUsage({
  operation: 'videos.list',
  cost: 1,
  totalUsage: 1250,
  remainingQuota: 8750,
  success: true
});
```

### Audit Logging (`audit-logger.ts`)
Provides audit trail for metadata changes and system events.

```typescript
import { auditLogger } from './audit-logger.js';

auditLogger.logMetadataChange({
  videoId: 'abc123',
  action: 'apply_metadata',
  oldValues: { title: 'Old Title' },
  newValues: { title: 'New Title' }
});
```

### Monitoring Dashboard (`monitoring-dashboard.ts`)
Aggregates data and generates reports.

```typescript
import { monitoringDashboard } from './monitoring-dashboard.ts';

const dashboardData = await monitoringDashboard.generateDashboardData();
const htmlReport = await monitoringDashboard.generateHTMLReport();
```

## Features

- **Structured Logging**: JSON-formatted logs with categories and metadata
- **File Rotation**: Automatic log rotation with configurable retention
- **Performance Tracking**: Precise timing and success rate monitoring
- **Quota Management**: Real-time quota usage tracking with alerts
- **Audit Trail**: Comprehensive audit logging for compliance
- **Dashboard Reports**: HTML and JSON reporting capabilities
- **MCP Compliance**: All logs written to stderr as required

## Configuration

Set environment variables to customize behavior:

```bash
LOG_LEVEL=info                    # debug, info, warn, error
LOG_DIR=/path/to/logs            # Custom log directory
ENABLE_FILE_LOGGING=true         # Enable/disable file logging
MAX_LOG_FILE_SIZE=10485760       # 10MB log rotation
MAX_LOG_FILES=7                  # Keep 7 days of logs
```

## Log Structure

```json
{
  "timestamp": "2025-09-27T10:30:45.123Z",
  "level": "info",
  "category": "api",
  "message": "Operation completed",
  "correlationId": "req_123",
  "operationType": "videos.list",
  "duration": 245,
  "metadata": {}
}
```

## File Organization

```
logs/
├── app-2025-09-27.log              # Daily application logs
├── audit/
│   ├── audit-2025-09-27.log        # Audit events
│   └── metadata-2025-09-27.log     # Metadata changes
└── dashboard/
    └── snapshot-*.json              # Dashboard snapshots
```

## Integration

The monitoring system is automatically integrated into:

- YouTube API client operations
- Metadata service operations
- Scheduler and batch operations
- OAuth authentication flows

## Demo

Run the monitoring demo to see all features:

```bash
npx tsx examples/monitoring-demo.ts
```

See the [implementation report](../../agents/monitoring/reports/implementation.md) for complete documentation.