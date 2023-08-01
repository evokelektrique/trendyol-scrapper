// Load environment files
const dotenv = require("dotenv");
dotenv.config();

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
   res.status(error.status);

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
   "/extract_archive",
   asyncHandler(async (req, res, next) => {
      if(!req.body.urls) {
         throw createError(422, "urls not defined");
      }
      
      const page = await Crawler.launch_browser();
      const base_url = "https://www.trendyol.com";
      const urls = req.body.urls;
      
      /**
       * Extract links
       */
      const limit = 200;
      let extracted_links = [];

      for (let i = 0; i < urls.length; i++) {
         const url = urls[i];
         const links = await Crawler.load_archive_page(page, url, limit);
         extracted_links.push(links);
      }
      // Flatten links array
      extracted_links = extracted_links.flat(Infinity);

      /**
       * Extract product
       */
      for (let i = 0; i < extracted_links.length; i++) {
         const url = base_url + extracted_links[i];

         const product = await Crawler.load_product_page(page, url);
         console.log(product);
      }

      // Close current page when the process is finished
      await page.close();
   })
);

/**
 * /extract_product
 */
app.post(
   "/extract_product",
   asyncHandler(async (req, res, next) => {
      if(!req.body.url) {
         throw createError(422, "url not defined");
      }
      
      const page = await Crawler.launch_browser();
      const product = await Crawler.load_product_page(page, req.body.url);
      await page.close();

      res.json({
         status: "success",
         data: {
            product: product
         },
      });
   })
);

// Error handling middleware
// app.use(middleware_errors);

// Start the server
app.listen(server_port, server_host, () => {
   console.log(`App is listening on port ${server_port}`);
});
