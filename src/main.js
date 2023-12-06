// Load environment files
const dotenv = require("dotenv");
dotenv.config();

const axios = require("axios");

// const tracer = require("./tracer")("node_trendyol_scrapper");

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
   console.log("Plugin path not found");
}
let confData = fs.readFileSync(plugin_path, "utf8");
confData = confData.replace(
   /antiCapthaPredefinedApiKey = ''/g,
   `antiCapthaPredefinedApiKey = '${apiKey}'`
);
fs.writeFileSync(plugin_path, confData, "utf8");

// Queues
const { Worker, Queue, QueueEvents, Job } = require("bullmq");
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const { FastSyncQueueInstance } = require("./queues/fastSyncQueueInstance.js");
const { ExtractLinkQueueInstance } = require("./queues/extractLinkQueueInstance.js");
const { ExtractArchiveQueueInstance } = require("./queues/exctractArchiveQueueInstance.js");

const extractArchiveQueueInstance = new ExtractArchiveQueueInstance();
const extractArchiveQueue = extractArchiveQueueInstance.queue;

const extractLinkQueueInstance = new ExtractLinkQueueInstance();
const extractLinkQueue = extractLinkQueueInstance.queue;

const fastSyncQueueInstance = new FastSyncQueueInstance();
const fastSyncQueue = fastSyncQueueInstance.queue;

const serverAdapter = new ExpressAdapter();
const bullBoard = createBullBoard({
   queues: [
      new BullMQAdapter(extractArchiveQueue),
      new BullMQAdapter(extractLinkQueue),
      new BullMQAdapter(fastSyncQueue),
   ],
   serverAdapter: serverAdapter,
});
serverAdapter.setBasePath("/admin");
app.use("/admin", serverAdapter.getRouter());

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
      if (!req.body.urls) {
         throw createError(422, "urls not defined");
      }

      extractArchiveQueue.add("extract_archive_queue", {
         urls: req.body.urls,
         uuid: req.body.uuid,
      });

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

      extractLinkQueue.add("extract_link_queue", {
         url: req.body.url,
         uuid: req.body.uuid,
      });

      const data = {
         status: "in_queue",
         data: [],
      };

      res.json(data);
      logger.debug(`Send response`);
   })
);

/**
 * /fast_sync
 */
app.post(
   "/fast_sync",
   asyncHandler(async (req, res, next) => {
      if (!req.body.url) {
         throw createError(422, "url not defined");
      }

      fastSyncQueue.add("fast_sync_queue", {
         url: req.body.url,
         uuid: req.body.uuid,
         target_link_titles: req.body.target_link_titles,
         variation_combination_id: req.body.variation_combination_id,
      });

      logger.debug(JSON.stringify({
         url: req.body.url,
         uuid: req.body.uuid,
         target_link_titles: req.body.target_link_titles,
         variation_combination_id: req.body.variation_combination_id,
      }));

      const data = {
         status: "in_queue",
         data: [],
      };

      res.json(data);
      logger.debug(`Send response`);
   })
);

// Error handling middleware
app.use((error, req, res, next) => {
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
   logger.info(`App is listening on port ${server_port}`);
});
