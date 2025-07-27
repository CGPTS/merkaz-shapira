import winston from 'winston';
import { LogLevel } from '../types/types';

// Create logger instance
const createLogger = (level: LogLevel = 'info') => {
  const logger = winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.prettyPrint()
    ),
    defaultMeta: { service: 'cgpts-telegram-bot' },
    transports: [
      // Console output
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
          })
        )
      }),
      // File output for errors
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }),
      // File output for all logs
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    ],
    // Handle uncaught exceptions
    exceptionHandlers: [
      new winston.transports.File({ filename: 'logs/exceptions.log' })
    ],
    // Handle unhandled promise rejections
    rejectionHandlers: [
      new winston.transports.File({ filename: 'logs/rejections.log' })
    ]
  });

  return logger;
};

// Create default logger
export const logger = createLogger();

// Function to update logger level dynamically
export const updateLoggerLevel = (level: LogLevel) => {
  logger.level = level;
  logger.info(`Log level updated to: ${level}`);
};

// Helper functions for common logging patterns
export const logError = (message: string, error?: Error | unknown, meta?: Record<string, any>) => {
  if (error instanceof Error) {
    logger.error(message, { error: error.message, stack: error.stack, ...meta });
  } else {
    logger.error(message, { error, ...meta });
  }
};

export const logUserAction = (userId: number, action: string, meta?: Record<string, any>) => {
  logger.info(`User action: ${action}`, { userId, ...meta });
};

export const logWhatsAppEvent = (event: string, meta?: Record<string, any>) => {
  logger.info(`WhatsApp event: ${event}`, { component: 'whatsapp', ...meta });
};

export const logTelegramEvent = (event: string, meta?: Record<string, any>) => {
  logger.info(`Telegram event: ${event}`, { component: 'telegram', ...meta });
};

export const logDatabaseOperation = (operation: string, meta?: Record<string, any>) => {
  logger.debug(`Database operation: ${operation}`, { component: 'database', ...meta });
};