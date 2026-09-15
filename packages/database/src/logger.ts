/**
 * Centralized logging utility for the application
 * Provides structured logging with better debugging and production monitoring
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isTest = process.env.NODE_ENV === 'test';

  /**
   * Log an informational message
   */
  info(message: string, context?: LogContext): void {
    if (this.isTest) return;
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    if (this.isTest) return;
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.isTest) return;

    const errorContext =
      error instanceof Error
        ? {
            ...context,
            error: error.message,
            stack: this.isDevelopment ? error.stack : undefined,
          }
        : { ...context, error: String(error) };

    this.log('error', message, errorContext);
  }

  /**
   * Log a debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment || this.isTest) return;
    this.log('debug', message, context);
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...context,
    };

    switch (level) {
      case 'error':
        console.error(this.isDevelopment ? logData : message, context);
        break;
      case 'warn':
        console.warn(this.isDevelopment ? logData : message, context);
        break;
      case 'debug':
        // Use console.warn for debug in allowed methods
        if (this.isDevelopment) {
          console.warn('[DEBUG]', logData);
        }
        break;
      default:
        // Use console.warn for info logs
        console.warn('[INFO]', this.isDevelopment ? logData : message, context);
    }
  }
}

// Export a singleton instance
export const logger = new Logger();
