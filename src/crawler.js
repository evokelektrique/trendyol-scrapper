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

   static async load_product_page_fast(page, url, target_link_titles) {
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
         is_available: false,
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
      } catch (e) { }

      /**
       * Extract product data
       */

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
            const variations = await this.extract_product_variations(page, true, target_link_titles);
            data.variations = variations;
            logger.debug(
               "Extracted product variations " + variations.length + " total"
            );
            break;

         case constant.product_type.simple:
            // Availability
            const is_available = await this.get_product_availability(page);
            data.available = is_available;

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
         is_available: false,
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
      } catch (e) { }

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
            // Availability
            const is_available = await this.get_product_availability(page);
            data.is_available = is_available;

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
      } catch (e) { }

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
    * Extract product variations based on specified attribute and link titles.
    *
    * @param {Object} page - Puppeteer's current browser page instance.
    * @param {boolean} is_fast - If true, optimize for speed and use target_link_titles.
    * @param {Array} target_link_titles - Array of link titles to target.
    * @returns {Array} - Array of product variations.
    */
   static async extract_product_variations(page, is_fast = false, target_link_titles = []) {
      const extracted_attributes = await this.extract_product_attritubtes(page);
      logger.debug('extracted_attributes ' + JSON.stringify(extracted_attributes));

      const attribute_titles = extracted_attributes.attribute_titles;
      const variations = [];

      // Empty attribute titles, we need to check for other attributes
      if (attribute_titles.length === 0) {
         const attributes = {}; // It's fine, the other loop won't even hit to get an error for this constant

         const other_attributes = await page.evaluate(Evaluate.evaluate_extract_product_other_variants);
         other_attributes.forEach(other_attribute => {
            attributes[other_attribute.title.toLowerCase()] = other_attribute.data;
         })
         logger.debug('other_attributes ' + JSON.stringify(other_attributes));

         const is_available = await this.get_product_availability(page);
         const images = await page.evaluate(Evaluate.evaluate_extract_product_images);
         const price = await page.evaluate(Evaluate.evaluate_extract_product_price);

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
            is_available: is_available,
         });
      }

      for (let index = 0; index < attribute_titles.length; index++) {
         const title = attribute_titles[index];
         const attribute_links = extracted_attributes.attributes[title];

         if (!is_fast) {
            for (let index = 0; index < attribute_links.length; index++) {
               const link = attribute_links[index];
               const attributes = {};
               const link_class_names = (await link.getProperty("className")).toString();
               const target_link_class_names = "selected";

               // Click on each attribute link
               try {
                  if (!link_class_names.includes(target_link_class_names)) {
                     await link.click();
                  } else {
                     logger.debug(`Skipping attribute link with title (${await link.getProperty("title")}), because it contains (${link_class_names}) class names`);
                  }
               } catch (e) {
                  logger.error(`Skipped error: ${e}`);
                  continue;
               }

               // Wait for 3 seconds
               await new Promise((resolve) => setTimeout(resolve, 3000));

               const linkTitle = (await link.getProperty("title")).toString().replace("JSHandle:", "").toLowerCase();
               attributes[title] = linkTitle;
               logger.debug('Added a new title(' + title + ') to attributes:' + linkTitle);

               const other_attributes = await page.evaluate(Evaluate.evaluate_extract_product_other_variants);
               other_attributes.forEach(other_attribute => {
                  attributes[other_attribute.title.toLowerCase()] = other_attribute.data;
               })
               logger.debug('other_attributes ' + JSON.stringify(other_attributes));

               const is_available = await this.get_product_availability(page);
               const images = await page.evaluate(Evaluate.evaluate_extract_product_images);
               const price = await page.evaluate(Evaluate.evaluate_extract_product_price);

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
                  is_available: is_available,
               });
            }
         } else {
            // If is_fast is true, process only target links based on target_link_titles
            for (let i = 0; i < attribute_links.length; i++) {
               const link = attribute_links[i];
               const linkTitle = (await link.getProperty("title")).toString().replace("JSHandle:", "").trim().toLowerCase();
               const linkContent = await page.evaluate(link => link.textContent.trim().toLowerCase(), link);
               const link_class_names = (await link.getProperty("className")).toString();

               let usedLinkInfo = '';
               logger.debug('linkTitle ' + linkTitle);
               logger.debug('linkContent ' + linkContent);

               if (target_link_titles.includes(linkTitle)) {
                  usedLinkInfo = 'linkTitle';
                  logger.debug('linkTitle ' + linkTitle + ' found in target_link_titles');
               } else if (target_link_titles.includes(linkContent)) {
                  usedLinkInfo = 'linkContent';
                  logger.debug('linkContent ' + linkContent + ' found in target_link_titles');
               } else {
                  usedLinkInfo = 'none';
               }

               if (target_link_titles.includes(linkTitle) || target_link_titles.includes(linkContent)) {
                  const attributes = {};
                  if (usedLinkInfo === 'linkTitle') {
                     attributes[title] = linkTitle;
                  } else {
                     attributes[title] = linkContent;
                  }

                  try {
                     if (!link_class_names.includes("selected")) {
                        await link.click();
                     } else {
                        logger.debug(`Skipping attribute link with title (${await link.getProperty("title")}), because it contains (${link_class_names}) class names`);
                     }
                  } catch (e) {
                     logger.error(`Skipped error: ${e}`);
                     continue;
                  }

                  await new Promise((resolve) => setTimeout(resolve, 3000));

                  // const images = await page.evaluate(Evaluate.evaluate_extract_product_images);
                  const price = await page.evaluate(Evaluate.evaluate_extract_product_price);

                  if (parseCurrency(price.regular)) {
                     price.regular = parseCurrency(price.regular).value;
                  }
                  if (parseCurrency(price.featured)) {
                     price.featured = parseCurrency(price.featured).value;
                  }

                  const is_available = await this.get_product_availability(page);

                  variations.push({
                     attributes: attributes,
                     images: [],
                     price: price,
                     is_available: is_available,
                  });
               }
            }
         }
      }

      logger.debug(`Extracted variations (${variations.length})`);
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

   static async get_product_availability(page) {
      const product_button_container = await page.$(".product-button-container");
      const sold_out_button = await product_button_container.$('.sold-out');
      const add_to_basket_button = await product_button_container.$('.add-to-basket');

      if (add_to_basket_button) {
         return true;
      }

      if (sold_out_button) {
         return false;
      }

      return true;
   }
}

module.exports = Crawler;
