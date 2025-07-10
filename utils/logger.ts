import pino from 'pino';

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
    pinoLogger[level.toLowerCase()]({ context, ...data }, message);
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
