const Crawler = require("../crawler");

// Logger
const logger = require("../logger");

module.exports = async (job) => {
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
         const url_index = urls[i];
         
         logger.debug('Extracting archive url: ' + url_index)
         
         // Add most recent products to url
         const url = new URL(url_index);
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
};
