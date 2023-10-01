// Load environment files
const dotenv = require("dotenv");
dotenv.config();

const axios = require("axios");

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
const { Worker, Queue, QueueEvents, Job } = require("bullmq");
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");

const queue_options = {
   defaultJobOptions: {
      attempts: 3,
      backoff: {
         type: "exponential",
         delay: 1000,
      },
   },
   connection: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
   },
};

const worker_options = {
   connection: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
   },
   limiter: {
      max: 10,
      duration: 60000,
   },
};

// Create a new connection in every instance
const extractLinkQueue = new Queue("extract_link_queue", queue_options);
const extractLinkQueueEvents = new QueueEvents(
   "extract_link_queue",
   queue_options
);
const extractLinkWorker = new Worker(
   "extract_link_queue",
   async (job) => {
      let data;

      try {
         const page = await Crawler.launch_browser();
         const product = await Crawler.load_product_page(page, job.data.url);
         await page.close();
         logger.info("Browser closed");

         data = {
            status: "success",
            data: {
               type: "link",
               uuid: job.data.uuid,
               url: job.data.url,
               product: product,
            },
         };
      } catch (error) {
         logger.info("Error " + error.message);

         data = {
            status: "failed",
            data: {
               type: "link",
               uuid: job.data.uuid,
               url: job.data.url,
               product: [],
            },
         };

         // await job.moveToFailed(e, token, false);
      }

      return data;
   },
   worker_options
);
extractLinkQueueEvents.on("completed", async ({ jobId }) => {
   logger.info("JOB COMPLETED " + jobId);
   const job = await Job.fromId(extractLinkQueue, jobId);
   const data = job.returnvalue;

   const url = process.env.KE_BASE_API_URL + "/link/store";
   const privateKey = process.env.KE_API_KEY; // Replace with your actual private API key
   const config = {
      headers: {
         PRIVATE_API_KEY: privateKey,
         "Content-Type": "application/json", // You can also include other headers here
      },
   };
   logger.info(`Request POST: url(${url})`);
   logger.info(`Request POST: url(${url}) - ` + JSON.stringify(data));
   try {
      const response = await axios.post(url, data, config);
      logger.info(`Response: url(${url}) - ` + JSON.stringify(response.data));
   } catch (error) {
      logger.error("Error: " + error.message);
   }
});

const extractArchiveQueue = new Queue("extract_archive_queue", queue_options);
const extractArchiveQueueEvents = new QueueEvents(
   "extract_archive_queue",
   queue_options
);
const extractArchiveWorker = new Worker(
   "extract_archive_queue",
   async (job) => {
      let data;

      try {
         const page = await Crawler.launch_browser();
         const urls = job.data.urls;

         /**
          * Extract links
          */
         const limit = 200;
         let extracted_links = [];
         for (let i = 0; i < urls.length; i++) {
            // Add most recent products to url
            const url = new URL(urls[i]);
            url.searchParams.append("sst", "MOST_RECENT");

            // Crawl it
            const links = await Crawler.load_archive_page(
               page,
               url.href,
               limit
            );
            extracted_links.push(links);
         }

         // Flatten links array
         extracted_links = extracted_links.flat(Infinity);
         const base_url = "https://www.trendyol.com";
         const linksWithBaseUrl = extracted_links.map(
            (link) => new URL(link, base_url).href
         );

         logger.debug(`Extracted links (${linksWithBaseUrl.length}) total`);

         // Close current page when the process is finished
         await page.close();
         logger.info("Browser closed");

         data = {
            status: "success",
            data: {
               type: "archive",
               uuid: job.data.uuid,
               url: urls[0],
               links: linksWithBaseUrl,
            },
         };
      } catch (error) {
         logger.info("Error " + error.message);

         data = {
            status: "failed",
            data: {
               type: "archive",
               uuid: job.data.uuid,
               url: urls[0],
               links: [],
            },
         };

         // await job.moveToFailed(e, token, false);
      }

      return data;
   },
   worker_options
);

extractArchiveQueueEvents.on("completed", async ({ jobId }) => {
   logger.info("JOB COMPLETED " + jobId);
   const job = await Job.fromId(extractArchiveQueue, jobId);
   const data = job.returnvalue;

   const url = process.env.KE_BASE_API_URL + "/link/store";
   const privateKey = process.env.KE_API_KEY; // Replace with your actual private API key
   const config = {
      headers: {
         PRIVATE_API_KEY: privateKey,
         "Content-Type": "application/json", // You can also include other headers here
      },
   };
   logger.info(`Request POST: url(${url}) - ` + JSON.stringify(data));
   try {
      const response = await axios.post(url, data, config);
      logger.info(`Response: url(${url}) - ` + JSON.stringify(response.data));
   } catch (error) {
      logger.error("Error: " + error.message);
   }
});

const fastSyncQueue = new Queue("fast_sync_queue", queue_options);
const fastSyncQueueEvents = new QueueEvents(
   "fast_sync_queue",
   queue_options
);
const fastSyncWorker = new Worker(
   "fast_sync_queue",
   async (job) => {
      let data;

      try {
         const page = await Crawler.launch_browser();
         const product = await Crawler.load_product_page_fast(page, job.data.url, job.data.target_link_titles);

         // Close current page when the process is finished
         await page.close();
         logger.info("Browser closed");

         data = {
            status: "success",
            data: {
               type: "link",
               uuid: job.data.uuid,
               url: job.data.url,
               variation_combination_id: job.data.variation_combination_id,
               target_link_titles: job.data.target_link_titles,
               product: product,
            },
         };
      } catch (error) {
         logger.info("Error " + error.message);

         data = {
            status: "failed",
            data: {
               type: "link",
               uuid: job.data.uuid,
               url: job.data.url,
               variation_combination_id: job.data.variation_combination_id,
               target_link_titles: job.data.target_link_titles,
               product: [],
            },
         };

         // await job.moveToFailed(e, token, false);
      }

      return data;
   },
   worker_options
);

fastSyncQueueEvents.on("completed", async ({ jobId }) => {
   logger.info("JOB COMPLETED " + jobId);
   const job = await Job.fromId(fastSyncQueue, jobId);
   const data = job.returnvalue;

   const url = process.env.KE_BASE_API_URL + "/link/fast_store";
   const privateKey = process.env.KE_API_KEY; // Replace with your actual private API key
   const config = {
      headers: {
         PRIVATE_API_KEY: privateKey,
         "Content-Type": "application/json", // You can also include other headers here
      },
   };
   logger.info(`Request POST: url(${url}) - ` + JSON.stringify(data));
   try {
      const response = await axios.post(url, data, config);
      logger.info(`Response: url(${url}) - ` + JSON.stringify(response.data));
   } catch (error) {
      logger.error("Error: " + error.message);
   }
});

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
