export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  constructor(private level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info') {}

  debug(message: string, meta?: Record<string, unknown>) {
    if (this.shouldLog('debug')) this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    if (this.shouldLog('info')) this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    if (this.shouldLog('warn')) this.log('warn', message, meta);
  }

  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    if (this.shouldLog('error')) {
      this.log('error', message, { ...meta, error: error instanceof Error ? error.stack : error });
    }
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
  }

  private shouldLog(level: LogLevel): boolean {
    const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return order.indexOf(level) >= order.indexOf(this.level);
  }
}

export const logger = new Logger();
