const Crawler = require("../crawler");

// Logger
const logger = require("../logger");

module.exports = async (job) => {
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
};
