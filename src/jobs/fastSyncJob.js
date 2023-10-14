const Crawler = require("../crawler");

// Logger
const logger = require("../logger");

module.exports = async (job) => {
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
};
