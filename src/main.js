// Load environment files
const dotenv = require("dotenv");
dotenv.config();

// const tracer = require("./tracer")("node_trendyol_scrapper");
const Crawler = require("./crawler.js");

// Express
const express = require("express");
const asyncHandler = require("express-async-handler"); // Async requests handler
require("express-async-errors"); // Async error handler

const createError = require("http-errors"); // Error handling
const app = express();
const server_port = process.env.SERVER_PORT;
const server_host = process.env.SERVER_HOST;

// File system
const fs = require("fs");
const path = require("path");

// Logger
const logger = require("./logger");

/**
 * Recaptcha solver configuration, replacing API
 */
const plugin_path = path.resolve("./plugin/js/config_ac_api_key.js"); // Convert relative to absolute path
const apiKey = process.env.RECAPTCHA_API;
// Set api key
if (!fs.existsSync(plugin_path)) {
   return "Plugin path not found";
}
let confData = fs.readFileSync(plugin_path, "utf8");
confData = confData.replace(
   /antiCapthaPredefinedApiKey = ''/g,
   `antiCapthaPredefinedApiKey = '${apiKey}'`
);
fs.writeFileSync(plugin_path, confData, "utf8");

// Queues
const { Worker, Queue } = require("bullmq");

const queue_options = {
   connection: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
   },
};

// Create a new connection in every instance
const extractLinkQueue = new Queue("extract_link_queue", queue_options);
const extractLinkWorker = new Worker("extract_link_queue", async (job) => {
   const page = await Crawler.launch_browser();
   const product = await Crawler.load_product_page(page, job.data.url);
   await page.close();
   logger.info("Browser closed");
}, queue_options);

const extractArchiveQueue = new Queue("extract_archive_queue", queue_options);
const extractArchiveWorker = new Worker("extract_archive_queue", async (job) => {
   console.log(job.data);
}, queue_options);


/**
 * Authenthication middleware
 */
const middleware_authenthication = function (req, res, next) {
   if (!req.headers["auth-key"]) {
      throw createError(401, "No auth-key is defined in request headers");
   }

   if (req.headers["auth-key"] !== process.env.AUTH_KEY_API) {
      throw createError(401, "Invalid auth-key");
   }

   next();
};

/**
 * Error handling middleware
 */
const middleware_errors = function (error, req, res, next) {
   // Sets HTTP status code
   res.status(500);

   // Sends response
   res.json({
      status: "error",
      message: error.message,
   });
};

// Json body parser
app.use(express.json());

// Set Authenthication middleware
app.use(middleware_authenthication);

/**
 * /extract_archive
 */
app.post(
   "/extract_archive_links",
   asyncHandler(async (req, res, next) => {
      // if (!req.body.urls) {
      //    throw createError(422, "urls not defined");
      // }

      // const page = await Crawler.launch_browser();

      // // // Set a timeout for page operations
      // // const operationTimeout = setTimeout(() => {
      // //    page.close();
      // //    logger.info("Browser closed due to timeout");
      // // }, 5 * 60 * 1000); // 5 minutes

      // const urls = req.body.urls;

      // /**
      //  * Extract links
      //  */
      // const limit = 200;
      // let extracted_links = [];

      // for (let i = 0; i < urls.length; i++) {
      //    const url = new URL(urls[i]); // Add most recent products to url
      //    url.searchParams.append("sst", "MOST_RECENT");
      //    const links = await Crawler.load_archive_page(page, url.href, limit);
      //    extracted_links.push(links);
      // }
      // // Flatten links array
      // extracted_links = extracted_links.flat(Infinity);
      // const base_url = "https://www.trendyol.com";
      // const linksWithBaseUrl = extracted_links.map(
      //    (link) => new URL(link, base_url).href
      // );

      // // clearTimeout(operationTimeout); // Clear the timeout

      // // Close current page when the process is finished
      // await page.close();
      // logger.info("Browser closed");

      // const data = {
      //    status: "success",
      //    data: {
      //       links: linksWithBaseUrl,
      //    },
      // };
      // res.json(data);
      // logger.debug(`Send response`);

      const data = {
         status: "in_queue",
         data: {
            links: [],
         },
      };
      res.json(data);
      logger.debug(`Send response`);
   })
);

/**
 * /extract_product
 */
app.post(
   "/extract_product",
   asyncHandler(async (req, res, next) => {
      if (!req.body.url) {
         throw createError(422, "url not defined");
      }

      extractLinkQueue.add(
         'extract_link_queue',
         { url: req.body.url },
         { removeOnComplete: true, removeOnFail: true },
      );
      
      const data = {
         status: "in_queue",
         data: []
      };

      res.json(data);
      logger.debug(`Send response`);
   })
);

// Error handling middleware
app.use((error, req, res, next) => {
   console.log(error);
   logger.error(error);

   // Handle known errors
   if (error instanceof createError.HttpError) {
      res.status(error.status).json({
         status: "error",
         message: error.message,
      });
   } else {
      // Handle unknown errors
      res.status(500).json({
         status: "error",
         message: "Internal server error",
      });
   }
});

// Start the server
const server = app.listen(server_port, server_host, async () => {
   console.log(`App is listening on port ${server_port}`);
});
