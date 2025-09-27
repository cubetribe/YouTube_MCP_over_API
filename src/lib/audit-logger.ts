import { logger, type AuditLogEntry } from './logger.js';
import { promises as fs } from 'fs';
import path from 'path';

export interface MetadataChangeAudit {
  videoId: string;
  userId?: string;
  action: 'generate_suggestion' | 'apply_metadata' | 'reject_suggestion' | 'backup_created';
  oldValues?: {
    title?: string;
    description?: string;
    tags?: string[];
    privacyStatus?: string;
  };
  newValues?: {
    title?: string;
    description?: string;
    tags?: string[];
    privacyStatus?: string;
  };
  suggestionId?: string;
  guardrailsAcknowledged?: boolean;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface SchedulerAudit {
  batchId: string;
  videoIds: string[];
  userId?: string;
  action: 'schedule_created' | 'schedule_executed' | 'schedule_failed' | 'schedule_cancelled';
  scheduledFor?: string;
  actualExecutedAt?: string;
  errorReason?: string;
  correlationId?: string;
}

export interface PlaylistAudit {
  playlistId: string;
  userId?: string;
  action: 'playlist_created' | 'videos_added' | 'playlist_updated' | 'playlist_deleted';
  videoIds?: string[];
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  correlationId?: string;
}

export class AuditLogger {
  private auditDir: string;

  constructor(auditDir?: string) {
    this.auditDir = auditDir || path.join(process.cwd(), 'logs', 'audit');\n    this.ensureAuditDirectory();\n  }\n\n  /**\n   * Log metadata change events\n   */\n  logMetadataChange(audit: MetadataChangeAudit): void {\n    const auditEntry: AuditLogEntry = {\n      timestamp: new Date().toISOString(),\n      userId: audit.userId,\n      action: audit.action,\n      resource: 'video_metadata',\n      resourceId: audit.videoId,\n      oldValues: audit.oldValues,\n      newValues: audit.newValues,\n      correlationId: audit.correlationId\n    };\n\n    logger.audit(auditEntry);\n\n    // Additional structured logging for metadata changes\n    logger.info(\n      `Metadata ${audit.action} for video ${audit.videoId}`,\n      'audit',\n      {\n        videoId: audit.videoId,\n        action: audit.action,\n        suggestionId: audit.suggestionId,\n        guardrailsAcknowledged: audit.guardrailsAcknowledged,\n        hasOldValues: !!audit.oldValues,\n        hasNewValues: !!audit.newValues,\n        userId: audit.userId,\n        correlationId: audit.correlationId,\n        ...audit.metadata\n      }\n    );\n\n    // Write detailed metadata audit log\n    this.writeMetadataAuditLog(audit).catch(error => {\n      logger.error('Failed to write metadata audit log', 'audit', error);\n    });\n  }\n\n  /**\n   * Log scheduler events\n   */\n  logSchedulerEvent(audit: SchedulerAudit): void {\n    const auditEntry: AuditLogEntry = {\n      timestamp: new Date().toISOString(),\n      userId: audit.userId,\n      action: audit.action,\n      resource: 'scheduler_batch',\n      resourceId: audit.batchId,\n      correlationId: audit.correlationId\n    };\n\n    logger.audit(auditEntry);\n\n    logger.info(\n      `Scheduler ${audit.action} for batch ${audit.batchId}`,\n      'audit',\n      {\n        batchId: audit.batchId,\n        action: audit.action,\n        videoCount: audit.videoIds.length,\n        scheduledFor: audit.scheduledFor,\n        actualExecutedAt: audit.actualExecutedAt,\n        errorReason: audit.errorReason,\n        userId: audit.userId,\n        correlationId: audit.correlationId\n      }\n    );\n  }\n\n  /**\n   * Log playlist events\n   */\n  logPlaylistEvent(audit: PlaylistAudit): void {\n    const auditEntry: AuditLogEntry = {\n      timestamp: new Date().toISOString(),\n      userId: audit.userId,\n      action: audit.action,\n      resource: 'playlist',\n      resourceId: audit.playlistId,\n      oldValues: audit.oldValues,\n      newValues: audit.newValues,\n      correlationId: audit.correlationId\n    };\n\n    logger.audit(auditEntry);\n\n    logger.info(\n      `Playlist ${audit.action} for playlist ${audit.playlistId}`,\n      'audit',\n      {\n        playlistId: audit.playlistId,\n        action: audit.action,\n        videoCount: audit.videoIds?.length,\n        hasOldValues: !!audit.oldValues,\n        hasNewValues: !!audit.newValues,\n        userId: audit.userId,\n        correlationId: audit.correlationId\n      }\n    );\n  }\n\n  /**\n   * Get audit history for a specific resource\n   */\n  async getAuditHistory(\n    resource: string,\n    resourceId: string,\n    since?: Date\n  ): Promise<AuditLogEntry[]> {\n    // This would typically query from a database or log files\n    // For now, return from in-memory logger\n    const allAudits = logger.getAuditLogs(since);\n    return allAudits.filter(audit => \n      audit.resource === resource && audit.resourceId === resourceId\n    );\n  }\n\n  /**\n   * Get metadata change history for a video\n   */\n  async getVideoMetadataHistory(videoId: string, since?: Date): Promise<MetadataChangeAudit[]> {\n    try {\n      const files = await fs.readdir(this.auditDir);\n      const metadataFiles = files.filter(f => f.startsWith('metadata-') && f.endsWith('.log'));\n      \n      const history: MetadataChangeAudit[] = [];\n      const sinceMs = since ? since.getTime() : 0;\n\n      for (const file of metadataFiles) {\n        const filePath = path.join(this.auditDir, file);\n        const content = await fs.readFile(filePath, 'utf-8');\n        const lines = content.split('\\n').filter(line => line.trim());\n\n        for (const line of lines) {\n          try {\n            const audit: MetadataChangeAudit = JSON.parse(line);\n            if (audit.videoId === videoId) {\n              const timestamp = new Date(audit.correlationId || 0).getTime();\n              if (timestamp >= sinceMs) {\n                history.push(audit);\n              }\n            }\n          } catch (parseError) {\n            // Skip malformed lines\n          }\n        }\n      }\n\n      return history.sort((a, b) => \n        new Date(a.correlationId || 0).getTime() - new Date(b.correlationId || 0).getTime()\n      );\n    } catch (error) {\n      logger.error('Failed to get metadata history', 'audit', error);\n      return [];\n    }\n  }\n\n  /**\n   * Export audit data for compliance or analysis\n   */\n  async exportAuditData(\n    outputPath: string,\n    options: {\n      since?: Date;\n      resource?: string;\n      userId?: string;\n    } = {}\n  ): Promise<void> {\n    const auditLogs = logger.getAuditLogs(options.since);\n    \n    let filteredLogs = auditLogs;\n    if (options.resource) {\n      filteredLogs = filteredLogs.filter(log => log.resource === options.resource);\n    }\n    if (options.userId) {\n      filteredLogs = filteredLogs.filter(log => log.userId === options.userId);\n    }\n\n    const exportData = {\n      exportedAt: new Date().toISOString(),\n      filters: options,\n      totalRecords: filteredLogs.length,\n      auditLogs: filteredLogs\n    };\n\n    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));\n    logger.info(`Audit data exported to ${outputPath}`, 'audit', {\n      recordCount: filteredLogs.length,\n      filters: options\n    });\n  }\n\n  private async ensureAuditDirectory(): Promise<void> {\n    try {\n      await fs.mkdir(this.auditDir, { recursive: true });\n    } catch (error) {\n      logger.error('Failed to create audit directory', 'audit', error);\n    }\n  }\n\n  private async writeMetadataAuditLog(audit: MetadataChangeAudit): Promise<void> {\n    const date = new Date().toISOString().split('T')[0];\n    const auditFile = path.join(this.auditDir, `metadata-${date}.log`);\n    \n    const auditRecord = {\n      ...audit,\n      timestamp: new Date().toISOString()\n    };\n\n    const logLine = JSON.stringify(auditRecord) + '\\n';\n    await fs.appendFile(auditFile, logLine);\n  }\n}\n\nexport const auditLogger = new AuditLogger();