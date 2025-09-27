import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'api' | 'auth' | 'metadata' | 'scheduler' | 'batch' | 'quota' | 'performance' | 'audit' | 'system';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  correlationId?: string;
  userId?: string;
  operationType?: string;
  duration?: number;
  quotaUsed?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface PerformanceMetrics {
  operationType: string;
  duration: number;
  success: boolean;
  quotaCost: number;
  timestamp: string;
  correlationId?: string;
}

export interface AuditLogEntry {
  timestamp: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  correlationId?: string;
}

class Logger {
  private logDir: string;
  private enableFileLogging: boolean;
  private maxFileSize: number;
  private maxFiles: number;
  private performanceMetrics: PerformanceMetrics[] = [];
  private auditLogs: AuditLogEntry[] = [];

  constructor(
    private level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info',
    options: {
      logDir?: string;
      enableFileLogging?: boolean;
      maxFileSize?: number;
      maxFiles?: number;
    } = {}
  ) {
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.enableFileLogging = options.enableFileLogging ?? true;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 7; // Keep 7 days

    if (this.enableFileLogging) {
      this.ensureLogDirectory();
    }
  }

  debug(message: string, category: LogCategory = 'system', meta?: Record<string, unknown>) {
    if (this.shouldLog('debug')) this.log('debug', category, message, meta);
  }

  info(message: string, category: LogCategory = 'system', meta?: Record<string, unknown>) {
    if (this.shouldLog('info')) this.log('info', category, message, meta);
  }

  warn(message: string, category: LogCategory = 'system', meta?: Record<string, unknown>) {
    if (this.shouldLog('warn')) this.log('warn', category, message, meta);
  }

  error(message: string, category: LogCategory = 'system', error?: unknown, meta?: Record<string, unknown>) {
    if (this.shouldLog('error')) {
      const errorObj = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : { message: String(error) };

      this.log('error', category, message, { ...meta, error: errorObj });
    }
  }

  private async log(level: LogLevel, category: LogCategory, message: string, meta?: Record<string, unknown>) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      ...meta,
    };

    // Always log to stderr for MCP compliance
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(logEntry));

    // Also log to file if enabled
    if (this.enableFileLogging) {
      try {
        await this.writeToFile(logEntry);
      } catch (error) {
        // Fallback to stderr if file logging fails
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          category: 'system',
          message: 'Failed to write to log file',
          error: error instanceof Error ? error.message : String(error)
        }));
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return order.indexOf(level) >= order.indexOf(this.level);
  }

  // Performance monitoring methods
  startTimer(operationType: string, correlationId?: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.recordPerformance({
        operationType,
        duration,
        success: true,
        quotaCost: 0,
        timestamp: new Date().toISOString(),
        correlationId
      });
    };
  }

  recordPerformance(metrics: PerformanceMetrics): void {
    this.performanceMetrics.push(metrics);

    // Keep only last 1000 metrics in memory
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }

    this.info(
      `Performance: ${metrics.operationType} completed in ${metrics.duration}ms`,
      'performance',
      {
        operationType: metrics.operationType,
        duration: metrics.duration,
        success: metrics.success,
        quotaCost: metrics.quotaCost,
        correlationId: metrics.correlationId
      }
    );
  }

  // Audit logging methods
  audit(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    this.auditLogs.push(auditEntry);

    // Keep only last 500 audit logs in memory
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(-500);
    }

    this.info(
      `Audit: ${entry.action} on ${entry.resource}:${entry.resourceId}`,
      'audit',
      {
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        correlationId: entry.correlationId
      }
    );

    // Write audit logs to separate file
    if (this.enableFileLogging) {
      this.writeAuditLog(auditEntry).catch(error => {
        this.error('Failed to write audit log', 'system', error);
      });
    }
  }

  // Monitoring data export
  getPerformanceMetrics(since?: Date): PerformanceMetrics[] {
    if (!since) return [...this.performanceMetrics];
    const sinceMs = since.getTime();
    return this.performanceMetrics.filter(m => new Date(m.timestamp).getTime() >= sinceMs);
  }

  getAuditLogs(since?: Date): AuditLogEntry[] {
    if (!since) return [...this.auditLogs];
    const sinceMs = since.getTime();
    return this.auditLogs.filter(log => new Date(log.timestamp).getTime() >= sinceMs);
  }

  async exportMonitoringData(outputPath: string): Promise<void> {
    const data = {
      exportedAt: new Date().toISOString(),
      performanceMetrics: this.performanceMetrics,
      auditLogs: this.auditLogs,
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: process.uptime()
      }
    };

    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    this.info(`Monitoring data exported to ${outputPath}`, 'system');
  }

  // File logging implementation
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      // If we can't create log directory, disable file logging
      this.enableFileLogging = false;
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        category: 'system',
        message: 'Failed to create log directory, disabling file logging',
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }

  private async writeToFile(logEntry: LogEntry): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `app-${date}.log`);

    await this.rotateLogsIfNeeded(logFile);

    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(logFile, logLine);
  }

  private async writeAuditLog(auditEntry: AuditLogEntry): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const auditFile = path.join(this.logDir, `audit-${date}.log`);

    const logLine = JSON.stringify(auditEntry) + '\n';
    await fs.appendFile(auditFile, logLine);
  }

  private async rotateLogsIfNeeded(logFile: string): Promise<void> {
    try {
      const stats = await fs.stat(logFile);
      if (stats.size >= this.maxFileSize) {
        await this.rotateLogs();
      }
    } catch (error) {
      // File doesn't exist yet, no rotation needed
    }
  }

  private async rotateLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files
        .filter(f => f.startsWith('app-') && f.endsWith('.log'))
        .sort()
        .reverse();

      // Remove old log files if we exceed maxFiles
      for (let i = this.maxFiles; i < logFiles.length; i++) {
        await fs.unlink(path.join(this.logDir, logFiles[i]));
      }
    } catch (error) {
      this.error('Failed to rotate logs', 'system', error);
    }
  }
}

export const logger = new Logger();
