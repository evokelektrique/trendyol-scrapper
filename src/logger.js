const { createLogger, transports, format } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Determine if the environment is production
const isProduction = process.env.APP_ENV === 'production';

// Create a logger instance
const logger = createLogger({
  level: 'debug', // Minimum logging level
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    // Log to the console if not in production
    !isProduction && new transports.Console(),

    // Log to a daily rotating file
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles: '14d',
    }),
  ].filter(Boolean), // Remove falsy values (e.g., null) from the array
});

module.exports = logger;
