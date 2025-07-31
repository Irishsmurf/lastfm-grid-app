import pino from 'pino';
import { writePoint } from '@/lib/influxdb';

// Define an enum for log levels for stricter type checking
enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// Define the interface for the logger
interface Logger {
  log: (level: LogLevel, context: string, message: string) => void;
  info: (context: string, message: string) => void;
  warn: (context: string, message: string) => void;
  error: (context: string, message: string) => void;
}

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

export const logger: Logger = {
  log: (
    level: LogLevel,
    context: string,
    message: string,
    data: object = {}
  ): void => {
    try {
      writePoint(
        'application_log',
        { level: level.toLowerCase(), context },
        { message, ...data }
      );
    } catch (error) {
      pinoLogger.error(
        { context: 'InfluxDB' },
        `Failed to write log to InfluxDB: ${error.message}`
      );
    }

    switch (level) {
      case LogLevel.INFO:
        pinoLogger.info({ context, ...data }, message);
        break;
      case LogLevel.WARN:
        pinoLogger.warn({ context, ...data }, message);
        break;
      case LogLevel.ERROR:
        pinoLogger.error({ context, ...data }, message);
        break;
      default:
        pinoLogger.info({ context, ...data }, message);
        break;
    }
  },
  info: (context: string, message: string): void => {
    logger.log(LogLevel.INFO, context, message);
  },
  warn: (context: string, message: string): void => {
    logger.log(LogLevel.WARN, context, message);
  },
  error: (context: string, message: string): void => {
    logger.log(LogLevel.ERROR, context, message);
  },
};
