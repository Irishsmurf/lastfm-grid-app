const logLevels = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

const logger = {
  log: (level, context, message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${level}] [${timestamp}] [${context}] ${message}`);
  },
  info: (context, message) => {
    logger.log(logLevels.INFO, context, message);
  },
  warn: (context, message) => {
    logger.log(logLevels.WARN, context, message);
  },
  error: (context, message) => {
    logger.log(logLevels.ERROR, context, message);
  },
};

module.exports = logger;
