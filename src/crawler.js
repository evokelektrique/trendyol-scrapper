const Evaluate = require("./evaluate.js");
const cookies = require("./cookies.js");
const constant = require("./constant.js");
const global_args = require("./args.js");

// Puppeteer
const puppeteer = require("puppeteer-core");

class Crawler {
   /**
    * Launch browser and return a new page instance
    *
    * @returns {Object} Browser new page instance
    */
   static async launch_browser() {
      const browser = await puppeteer.connect({
         // executablePath: executablePath(),
         headless: false,
         browserWSEndpoint:
            process.env.BROWSERLESS_URL + process.env.BROWSERLESS_API,
         ignoreDefaultArgs: ["--disable-extensions", "--enable-automation"],
         args: global_args,
         devtools: false,
      });

      const page = await browser.newPage();

      return page;
   }

   /**
    * Fetch single product page
    *
    * @param {Object} page
    * @param {String} url
    */
   static async load_product_page(page, url) {
      // Initial product data structure
      const data = {
         type: null,
         title: null,
         brand: null,
         description: null,
         price: null,
         price_code: constant.currency.tr.code,
         variations: [],
         recent_reviews: [],
         properties: [],
         images: [],
      };

      // Set TR cookies
      await page.setCookie(...cookies);
      await page.goto(url, {
         waitUntil: "networkidle2",
      });

      // Remove unnecessary elements form current page
      try {
         await this.remove_elements(page);
      } catch (e) {}

      /**
       * Extract product data
       */

      // Extract product title
      const title = await page.evaluate(
         Evaluate.evaluate_extract_product_title
      );
      data.title = title;

      // Extract product brand
      const brand = await page.evaluate(
         Evaluate.evaluate_extract_product_brand
      );
      data.brand = brand;

      // Extract description
      const description = await page.evaluate(
         Evaluate.evaluate_extract_product_description
      );
      data.description = description;

      // Extract images
      const images = await page.evaluate(
         Evaluate.evaluate_extract_product_images
      );
      data.images = images;

      // Extract extra attributes
      const properties = await page.evaluate(
         Evaluate.evaluate_extract_product_properties
      );
      data.properties = properties;

      // Get product type, It's either SIMPLE or VARIANT
      const type = await this.get_product_type(page);
      data.type = type;

      switch (type) {
         case constant.product_type.variant:
            // Extract product variations and its prices
            const variations = await this.extract_product_variations(page);
            data.variations = variations;
            break;

         case constant.product_type.simple:
            const price = await page.evaluate(
               Evaluate.evaluate_extract_product_price
            );
            data.price = price;
            break;

         default:
            break;
      }

      return data;
   }

   /**
    * Fetch the archive page
    *
    * @param {Object} page Puppeteer page instance
    * @param {String} url Fetch the given URL
    * @param {Integer} limit Set a limit for extracted links
    * @returns Array of string links
    */
   static async load_archive_page(page, url, limit = 200) {
      await page.setCookie(...cookies);
      await page.goto(url, {
         waitUntil: "networkidle2",
      });

      try {
         await this.remove_elements(page);
      } catch (e) {}

      // Extract links
      const links = [];
      let previousHeight;

      while (links.flat().length < limit) {
         const hrefs = await page.evaluate(
            Evaluate.evaluate_extract_archive_hrefs
         );
         links.push(hrefs.flat());
         previousHeight = await page.evaluate("document.body.scrollHeight");
         await page.evaluate(
            "document.querySelector('.prdct-cntnr-wrppr').scrollIntoView({block:'end'})"
         );
         await page.waitForTimeout(2000);
      }

      return links;
   }

   /**
    * Extract current page is product variations
    *
    * @param {Object} page Puppeteer's current browser page instance
    * @returns {Object} current page is product variations
    */
   static async extract_product_variations(page) {
      const extracted_attributes = await this.extract_product_attritubtes(page);
      const attribute_titles = extracted_attributes.attribute_titles;
      const variations = [];

      for (let index = 0; index < attribute_titles.length; index++) {
         const title = attribute_titles[index];
         const attribute_links = extracted_attributes.attributes[title];

         // Loop through links
         for (let index = 0; index < attribute_links.length; index++) {
            const link = attribute_links[index];
            const attributes = {};
            // click on variation to fetch new data and new price and wait for 2 seconds
            await link.click();
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Current product attribute title
            const link_title_property = await link.getProperty("title");
            const link_title = await link_title_property
               .toString()
               .replace("JSHandle:", "");
            attributes[constant.i18n[title].en] = link_title;

            // Check if attribute sizes is available
            const is_attribute_available_size = await page.evaluate(
               Evaluate.evaluate_is_attribute_available_size
            );
            // Size variant
            if (is_attribute_available_size) {
               const attributes_sizes = await page.evaluate(
                  Evaluate.evaluate_extract_product_size_variants
               );
               attributes[constant.i18n[attributes_sizes.title].en] =
                  attributes_sizes.data;
            }

            const images = await page.evaluate(
               Evaluate.evaluate_extract_product_images
            );
            const price = await page.evaluate(
               Evaluate.evaluate_extract_product_price
            );

            variations.push({
               attributes: attributes,
               images: images,
               price: price,
            });
         }
      }

      return variations;
   }

   /**
    * Check current page is product type
    *
    * @returns Variant Or Simple
    */
   static async get_product_type(page) {
      // Extract title
      const element = await page.$(".slicing-attributes");
      const element_content = await element.evaluate((e) => e.innerText);

      if (!element || element_content === "") {
         return constant.product_type.simple;
      }

      return constant.product_type.variant;
   }

   static async extract_product_attritubtes(page) {
      const data = {
         attributes: {},
         attribute_titles: [],
      };

      const attributes_wrappers = await page.$$(".slicing-attributes");

      for (let index = 0; index < attributes_wrappers.length; index++) {
         const attributes_wrapper = attributes_wrappers[index];

         // Extract variation links
         const attribute_links = await attributes_wrapper.$$("a");

         // Extract title
         const attribute_title = await attributes_wrapper.$eval(
            ".slc-title",
            (title) => title.innerText.replaceAll(":", "").trim().toLowerCase()
         );

         data.attribute_titles.push(attribute_title);
         data.attributes[attribute_title] = attribute_links;
      }

      console.log('attributes data', data);

      return data;
   }

   // Used to remove unnecessary elements in current page
   static async remove_elements(page) {
      // Browserless removes this
      // await page.waitForSelector("#onetrust-consent-sdk", {
      //    timeout: 30000,
      // });

      await page.evaluate(Evaluate.evaluate_remove_elements);
      await page.evaluate(Evaluate.evaluate_change_product_variation_sliders);
   }
}

module.exports = Crawler;
