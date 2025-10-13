import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

/**
 * Winston Logger Configuration
 *
 * Features:
 * - Console transport for development
 * - File transport for production
 * - Daily rotating files
 * - Separate error log file
 * - Custom formatting
 * - Log levels: error, warn, info, http, debug
 */

// Environment
const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

// Log directory
const logDir = process.env.LOG_DIR || 'logs';

// Custom log format
const customFormat = winston.format.printf(
  ({
    timestamp,
    level,
    message,
    context,
    trace,
    correlationId,
    ...metadata
  }) => {
    let msg = `${timestamp} [${level}] [${context || 'Application'}]`;

    if (correlationId) {
      msg += ` [${correlationId}]`;
    }

    msg += `: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }

    // Add stack trace for errors
    if (trace) {
      msg += `\n${trace}`;
    }

    return msg;
  },
);

// Console transport for development
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.ms(),
    nestWinstonModuleUtilities.format.nestLike('MASH-Backend', {
      colors: true,
      prettyPrint: true,
    }),
  ),
});

// File transport for all logs
const fileTransport = new DailyRotateFile({
  dirname: logDir,
  filename: 'application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    customFormat,
  ),
});

// File transport for errors only
const errorFileTransport = new DailyRotateFile({
  dirname: logDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    customFormat,
  ),
});

// Combined log file (non-rotating, for debugging)
const combinedFileTransport = new winston.transports.File({
  dirname: logDir,
  filename: 'combined.log',
  maxsize: 10485760, // 10MB
  maxFiles: 5,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    customFormat,
  ),
});

/**
 * Logger configuration factory
 * Returns different transports based on environment
 */
export const createLoggerConfig = () => {
  const transports: winston.transport[] = [];

  // Always add console in development
  if (isDevelopment) {
    transports.push(consoleTransport);
  }

  // Add file transports in production or if LOG_TO_FILE is true
  if (isProduction || process.env.LOG_TO_FILE === 'true') {
    transports.push(fileTransport);
    transports.push(errorFileTransport);
    transports.push(combinedFileTransport);
  }

  // If no transports, add console as fallback
  if (transports.length === 0) {
    transports.push(consoleTransport);
  }

  return {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
    ),
    transports,
    exitOnError: false,
  };
};

/**
 * Winston instance configuration for NestJS
 */
export const loggerConfig = {
  transports: createLoggerConfig().transports,
  format: createLoggerConfig().format,
  level: createLoggerConfig().level,
  exitOnError: false,
};

/**
 * Export individual transports for testing
 */
export {
  consoleTransport,
  fileTransport,
  errorFileTransport,
  combinedFileTransport,
};
