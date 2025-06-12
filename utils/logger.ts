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

export const logger: Logger = {
  log: (level: LogLevel, context: string, message: string): void => {
    const timestamp = new Date().toISOString();
    console.log(`[${level}] [${timestamp}] [${context}] ${message}`);
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
