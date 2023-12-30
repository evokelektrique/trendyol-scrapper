const Crawler = require("../crawler");

// Logger
const logger = require("../logger");

module.exports = async (job) => {
   let data;

   try {
      const url = job.data.url;
      const product_id = job.data.product_id;
      const reviews = await Crawler.load_reviews(url);
      logger.info("Reviews fetched");

      data = {
         status: "success",
         data: {
            type: "product_review",
            reviews: reviews,
            product_id: product_id,
            url: url,
         },
      };
   } catch (error) {
      logger.info("Error " + error.message);

      data = {
         status: "failed",
         data: {
            type: "product_review",
            reviews: [],
            product_id: product_id,
            url: url,
         },
      };
   }

   return data;
};
