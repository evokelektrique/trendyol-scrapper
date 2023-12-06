const { createLogger, transports, format } = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const GelfTransport = require('winston-gelf');

const options = {
   gelfPro: {
      fields: {
         env: process.APP_ENV,
         facility: 'trendyol-scrapper'
      },
      adapterName: 'udp', // optional; currently supported "udp", "tcp" and "tcp-tls"; default: udp
      adapterOptions: { // this object is passed to the adapter.connect() method        
         host: process.env.GELF_ADDRESS, // optional; default: 127.0.0.1
         port: 12201, // optional; default: 12201
      }
   }
}
const gelfTransport = new GelfTransport(options);

const timezoned = () => {
   return new Date().toLocaleString("en-US", {
      timeZone: process.env.TIMEZONE,
   });
};

// Create a logger instance
const logger = createLogger({
   level: "debug", // Minimum logging level
   format: format.combine(
      format.timestamp({ format: timezoned }),
      format.printf(({ timestamp, level, message }) => {
         return `${timestamp} [${level.toUpperCase()}]: ${message}`;
      })
   ),
   transports: [
      // Log to the console if not in production
      new transports.Console(),

      // Log to a daily rotating file
      new DailyRotateFile({
         filename: "logs/app-%DATE%.log",
         datePattern: "YYYY-MM-DD",
         zippedArchive: true,
         maxFiles: "30d",
      }),

      gelfTransport,
   ].filter(Boolean), // Remove falsy values (e.g., null) from the array
});

module.exports = logger;
