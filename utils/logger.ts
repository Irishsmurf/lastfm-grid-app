import pino from 'pino';

// Define an enum for log levels for stricter type checking
enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// Define the interface for the logger
interface Logger {
  log: (level: LogLevel, context: string, message: string, data?: object) => void;
  info: (context: string, message: string, data?: object) => void;
  warn: (context: string, message: string, data?: object) => void;
  error: (context: string, message: string, data?: object) => void;
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
  info: (context: string, message: string, data?: object): void => {
    logger.log(LogLevel.INFO, context, message, data);
  },
  warn: (context: string, message: string, data?: object): void => {
    logger.log(LogLevel.WARN, context, message, data);
  },
  error: (context: string, message: string, data?: object): void => {
    logger.log(LogLevel.ERROR, context, message, data);
  },
};
