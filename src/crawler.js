const Evaluate = require("./evaluate.js");
const cookies = require("./cookies.js");
const constant = require("./constant.js");
const global_args = require("./args.js");
const { executablePath } = require("puppeteer");
const parseCurrency = require("parsecurrency");

// Puppeteer
const puppeteer = require("puppeteer-core");
const logger = require("./logger.js");

class Crawler {
   /**
    * Launch browser and return a new page instance
    *
    * @returns {Object} Browser new page instance
    */
   static async launch_browser() {
      let browser = null;

      if (process.env.APP_ENV === "production") {
         browser = await puppeteer.connect({
            // executablePath: executablePath(),
            headless: false,
            browserWSEndpoint:
               process.env.BROWSERLESS_URL + process.env.BROWSERLESS_API,
            ignoreDefaultArgs: ["--disable-extensions", "--enable-automation"],
            args: global_args,
            devtools: false,
         });
      } else {
         browser = await puppeteer.launch({
            args: global_args,
            ignoreDefaultArgs: ["--disable-extensions", "--enable-automation"],
            executablePath: executablePath(),
            headless: false,
            devtools: true,
         });
      }

      logger.info(`Browser launched in (${process.env.APP_ENV}) environment`);

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
         source: constant.source,
         type: null,
         title: null,
         brand: null,
         description: null,
         price: null,
         currency_code: constant.currency.tr.code,
         variations: [],
         recent_reviews: [],
         properties: [],
         images: [],
      };

      logger.info("Opening " + url);

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
      logger.debug("Extracted product title " + title);

      // Extract product brand
      const brand = await page.evaluate(
         Evaluate.evaluate_extract_product_brand
      );
      data.brand = brand;
      logger.debug("Extracted product brand " + brand);

      // Extract description
      const description = await page.evaluate(
         Evaluate.evaluate_extract_product_description
      );
      data.description = description;
      logger.debug("Extracted product description " + description);

      // Extract images
      const images = await page.evaluate(
         Evaluate.evaluate_extract_product_images
      );
      data.images = images;
      logger.debug("Extracted product images " + images.length + " total");

      // Extract extra attributes
      const properties = await page.evaluate(
         Evaluate.evaluate_extract_product_properties
      );
      data.properties = properties;
      logger.debug(
         "Extracted product properties " + properties.length + " total"
      );

      // Get product type, It's either SIMPLE or VARIANT
      const type = await this.get_product_type(page);
      data.type = type;
      logger.debug("Extracted product type " + type);

      switch (type) {
         case constant.product_type.variable:
            // Extract product variations and its prices
            const variations = await this.extract_product_variations(page);
            data.variations = variations;
            logger.debug(
               "Extracted product variations " + variations.length + " total"
            );
            break;

         case constant.product_type.simple:
            const price = await page.evaluate(
               Evaluate.evaluate_extract_product_price
            );
            if (parseCurrency(price.regular) || parseCurrency(price.featured)) {
               data.price = price;
               if (parseCurrency(data.price.regular)) {
                  data.price.regular = parseCurrency(data.price.regular).value;
               }
               if (parseCurrency(data.price.featured)) {
                  data.price.featured = parseCurrency(
                     data.price.featured
                  ).value;
               }
            }
            logger.debug(
               `Extracted product prices (regular: ${data.price.regular}) - (featured: ${data.price.featured})`
            );
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
      logger.debug(`Loading archive page (${url}) with limit of (${limit})`);

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

      logger.debug(`Extracted links (${links.length}) total`);

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
            const link_class_names = (
               await link.getProperty("className")
            ).toString();

            // click on variation to fetch new data and new price and wait for 4 seconds
            try {
               // Do not click on selected attributes, because it changes the current page and interrupts the navigation
               if (!link_class_names.includes("selected")) {
                  logger.debug(
                     `Skipping attribute link with title (${await link.getProperty(
                        "title"
                     )}), because it contains (${link_class_names}) class names`
                  );

                  await link.click();
               }
            } catch (e) {
               logger.error(`Skipped error: ${e}`);
               continue;
            }

            await new Promise((resolve) => setTimeout(resolve, 4000));

            // Current product attribute title
            const link_title_property = await link.getProperty("title");
            const link_title = await link_title_property
               .toString()
               .replace("JSHandle:", "");
            attributes[title] = link_title;

            // Check if attribute sizes is available
            const is_attribute_available_size = await page.evaluate(
               Evaluate.evaluate_is_attribute_available_size
            );
            // Size variant
            if (is_attribute_available_size) {
               const attributes_sizes = await page.evaluate(
                  Evaluate.evaluate_extract_product_size_variants
               );
               attributes[attributes_sizes.title] = attributes_sizes.data;
            }

            const images = await page.evaluate(
               Evaluate.evaluate_extract_product_images
            );

            // Fetch and parse prices
            const price = await page.evaluate(
               Evaluate.evaluate_extract_product_price
            );
            if (parseCurrency(price.regular)) {
               price.regular = parseCurrency(price.regular).value;
            }
            if (parseCurrency(price.featured)) {
               price.featured = parseCurrency(price.featured).value;
            }

            variations.push({
               attributes: attributes,
               images: images,
               price: price,
            });
         }
      }

      logger.debug(`Extracted variations (${JSON.stringify(variations)})`);

      return variations;
   }

   /**
    * Check current page is product type
    *
    * @returns Variant Or Simple
    */
   static async get_product_type(page) {
      const container = await page.$('.container-right-content');
      
      // Extract title
      const element = await container.$(".slicing-attributes");
      let element_content = "";
      if (element) {
         element_content = await element.evaluate((e) => e.innerText);
      }

      const other_attributes = await container.$('[class*="-variant-wrapper"]');
      let other_attributes_content = "";
      if (other_attributes) {
         other_attributes_content = await other_attributes.evaluate(
            (e) => e.innerText
         );
      }

      if (
         element_content === "" &&
         other_attributes_content === ""
      ) {
         return constant.product_type.simple;
      }

      return constant.product_type.variable;
   }

   static async extract_product_attritubtes(page) {
      const data = {
         attributes: {},
         attribute_titles: [],
      };

      const wrapper = await page.$(".container-right-content");
      const attributes_wrappers = await wrapper.$$(
         ".slicing-attributes section"
      );
      const other_attributes = await wrapper.$$('[class*="-variant-wrapper"]');

      for (let index = 0; index < attributes_wrappers.length; index++) {
         const attributes_wrapper = attributes_wrappers[index];

         const attributes_wrapper_content = await attributes_wrapper.evaluate(
            (e) => e.innerText
         );

         if (attributes_wrapper_content === "") {
            continue;
         }

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

      for (let index = 0; index < other_attributes.length; index++) {
         const other_attribute = other_attributes[index];

         const other_attribute_content = await other_attribute.evaluate(
            (e) => e.innerText
         );

         if (other_attribute_content === "") {
            continue;
         }

         // Extract variation links
         const attribute_links = await other_attribute.$$(".sp-itm:not(.so)");

         // Extract title
         const attribute_title = await other_attribute.$eval(
            "[class*='-variant-title--bold']",
            (title) => title.innerText.replaceAll(":", "").trim().toLowerCase()
         );

         data.attribute_titles.push(attribute_title);
         data.attributes[attribute_title] = attribute_links;
      }

      logger.debug(`Extracted attributes (${JSON.stringify(data)})`);

      return data;
   }

   // Used to remove unnecessary elements in current page
   static async remove_elements(page) {
      logger.debug(`Removing elements of url (${await page.url()})`);

      // Browserless removes this
      // await page.waitForSelector("#onetrust-consent-sdk", {
      //    timeout: 30000,
      // });

      await page.evaluate(Evaluate.evaluate_remove_elements);
      await page.evaluate(Evaluate.evaluate_change_product_variation_sliders);
   }
}

module.exports = Crawler;
