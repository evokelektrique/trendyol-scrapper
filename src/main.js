const fs = require("fs");
const path = require("path");
// const puppeteer = require("puppeteer-extra");
const puppeteer = require("puppeteer-core");
// const StealthPlugin = require("puppeteer-extra-plugin-stealth");
// const AdblockPlugin = require("puppeteer-extra-plugin-adblocker");
const global_args = require("./args.js");
const cookies = require("./cookies.js");
const constant = require("./constant.js");
const dotenv = require("dotenv");

// get config vars
dotenv.config();

// puppeteer.use(StealthPlugin());
// puppeteer.use(AdblockPlugin());

const { executablePath } = require("puppeteer");

const plugin_path = path.resolve("./plugin/js/config_ac_api_key.js"); // Convert relative to absolute path
// Set api key
const apiKey = process.env.RECAPTCHA_API;

console.log(apiKey);
if (fs.existsSync(plugin_path)) {
   let confData = fs.readFileSync(plugin_path, "utf8");
   confData = confData.replace(
      /antiCapthaPredefinedApiKey = ''/g,
      `antiCapthaPredefinedApiKey = '${apiKey}'`
   );
   fs.writeFileSync(plugin_path, confData, "utf8");
} else {
   console.error("Plugin configuration not found!");
}

const urls = [
   "https://www.trendyol.com/sr?cid=621840",
   "https://www.trendyol.com/sr?cid=621828",
];
const base_url = "https://www.trendyol.com";
const base_url_images_cdn = "https://cdn.dsmcdn.com/";

// Main stuff
(async () => {
   // Init browser
   try {
      const browser = await puppeteer.connect({
         headless: false,
         // executablePath: executablePath(),
         browserWSEndpoint:
            process.env.BROWSERLESS_URL + process.env.BROWSERLESS_API,
         ignoreDefaultArgs: ["--disable-extensions", "--enable-automation"],
         args: global_args,
         devtools: true,
      });

      const page = await browser.newPage();

      /**
       * Extract links
       */
      const limit = 200;
      let extracted_links = [];

      for (let i = 0; i < urls.length; i++) {
         const url = urls[i];
         const links = await load_archive_page(page, url, limit);
         console.log("links", links);
         extracted_links.push(links);
      }
      extracted_links = extracted_links.flat(Infinity);
      console.log(extracted_links, extracted_links.length);

      /**
       * Extract product
       */
      for (let i = 0; i < extracted_links.length; i++) {
         const url = base_url + extracted_links[i];

         const product = await load_product_page(page, url);
         console.log(product);
      }
      // const url =
      // "https://www.trendyol.com/trendyolmilla/siyah-100-pamuk-vatka-gorunumlu-basic-bisiklet-yaka-orme-t-shirt-twoss20ts0021-p-35503713?boutiqueId=621840&merchantId=968";

      // const url =
      // "https://www.trendyol.com/tommy-hilfiger/th-modern-leather-mini-cc-wallet-p-667372882?boutiqueId=61&merchantId=423224";

      // const url =
      //    "https://www.trendyol.com/kigili/erkek-lacivert-polo-yaka-regular-fit-nakisli-tisort-p-713053844";

      // const product = await load_product_page(page, url);
      // console.log(product);

      await page.close();
   } catch (e) {
      console.log(e);
   }
})();

/**
 * Fetch single product page
 *
 * @param {Object} page
 * @param {String} url
 */
async function load_product_page(page, url) {
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
   };

   // Set TR cookies
   await page.setCookie(...cookies);
   await page.goto(url, {
      waitUntil: "networkidle2",
   });

   // Remove unnecessary elements form current page
   try {
      await remove_elements(page);
   } catch (e) {}

   /**
    * Extract product data
    */

   // Extract product title
   const title = await page.evaluate(evaluate_extract_product_title);
   data.title = title;

   // Extract product brand
   const brand = await page.evaluate(evaluate_extract_product_brand);
   data.brand = brand;

   const description = await page.evaluate(
      evaluate_extract_product_description
   );
   data.description = description;

   const properties = await page.evaluate(evaluate_extract_product_properties);
   data.properties = properties;

   // Get product type, It's either SIMPLE or VARIANT
   const type = await get_product_type(page);
   data.type = type;

   switch (type) {
      case constant.product_type.variant:
         // Extract product variations and its prices
         const variations = await extract_product_variations(page);
         data.variations = variations;
         break;

      case constant.product_type.simple:
         const price = await page.evaluate(evaluate_extract_product_price);
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
async function load_archive_page(page, url, limit = 200) {
   await page.setCookie(...cookies);
   await page.goto(url, {
      waitUntil: "networkidle2",
   });

   try {
      await remove_elements(page);
   } catch (e) {}

   // Extract links
   const links = [];
   let previousHeight;

   while (links.flat().length < limit) {
      const hrefs = await page.evaluate(evaluate_extract_archive_hrefs);
      links.push(hrefs.flat());
      previousHeight = await page.evaluate("document.body.scrollHeight");
      await page.evaluate(
         "document.querySelector('.prdct-cntnr-wrppr').scrollIntoView({block:'end'})"
      );
      await page.waitForTimeout(2000);
   }

   return links;
}

// Used to evaluate page hrefs
function evaluate_extract_archive_hrefs() {
   const tags = document.querySelectorAll(".p-card-wrppr a");
   const hrefs = [];

   Array.from(tags).forEach((anchor) => {
      hrefs.push(anchor.getAttribute("href"));
   });

   return hrefs;
}

function evaluate_extract_product_images() {
   const image_elements = document.querySelectorAll(
      ".gallery-container .product-slide img"
   );
   const image_sources = [];
   Array.from(image_elements).forEach((element) => {
      image_sources.push(element.src.replace("mnresize/128/192/", ""));
   });

   return image_sources;
}

function evaluate_extract_product_properties() {
   const wrapper = document.querySelector(".detail-attr-container");
   const items = wrapper.querySelectorAll(".detail-attr-item");
   const properties = {};

   Array.from(items).forEach((item) => {
      const elements = item.querySelectorAll("span");
      const key = elements[0].innerText.trim().toLowerCase();
      const value = elements[1].innerText.trim().toLowerCase();

      properties[key] = value;
   });

   return properties;
}

/**
 * Evaluate extract the price of current page is product
 *
 * @returns {Object} Regular price and Featured price
 */
function evaluate_extract_product_price() {
   const wrapper = document.querySelector(".container-right-content");
   let regular_price = null;
   let featured_price = null;

   const is_featured_price = wrapper.querySelector(".featured-price-box");
   if (is_featured_price) {
      regular_price = is_featured_price.querySelector(".prc-org");
      if (regular_price) {
         regular_price = regular_price.innerText
            .replace("TL", "")
            .replace(",", ".")
            .replace(".", "")
            .trim();
      }

      featured_price = is_featured_price.querySelector(".prc-dsc");
      if (featured_price) {
         featured_price = featured_price.innerText
            .replace("TL", "")
            .replace(",", ".")
            .replace(".", "")
            .trim();
      }

      return {
         regular: regular_price,
         featured: featured_price,
      };
   }

   regular_price = wrapper.querySelector(".product-price-container");
   if (regular_price) {
      regular_price = regular_price.innerText
         .replace("TL", "")
         .replace(",", ".")
         .replace(".", "")
         .trim();
   }

   return {
      regular: regular_price,
      featured: null,
   };
}

async function extract_product_variations(page) {
   const extracted_attributes = await extract_product_attritubtes(page);
   const attribute_titles = extracted_attributes.attribute_titles;
   const variations = [];

   for (let index = 0; index < attribute_titles.length; index++) {
      const title = attribute_titles[index];
      const attribute_links = extracted_attributes.attributes[title];

      // Loop through links
      for (let index = 0; index < attribute_links.length; index++) {
         const link = attribute_links[index];
         const attributes = [];
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
            evaluate_is_attribute_available_size
         );
         // Size variant
         if (is_attribute_available_size) {
            const attributes_sizes = await page.evaluate(
               extract_product_size_variants
            );
            attributes[constant.i18n[attributes_sizes.title].en] =
               attributes_sizes.data;
         }

         const images = await page.evaluate(evaluate_extract_product_images);
         const price = await page.evaluate(evaluate_extract_product_price);

         variations.push({
            attributes: attributes,
            images: images,
            price: price,
         });

         console.log({
            attributes: attributes,
            images: images,
            price: price,
         });
      }
   }

   return variations;
}

function extract_product_size_variants() {
   const wrapper = document.querySelector(
      ".container-right-content .size-variant-wrapper"
   );
   const items = wrapper.querySelectorAll(".sp-itm:not(.so)");
   const title = wrapper
      .querySelector(".size-variant-title--bold")
      .innerText.trim()
      .toLowerCase();
   const sizes = [];

   Array.from(items).forEach((items) => {
      sizes.push(items.innerText.trim().toLowerCase());
   });

   return {
      title: title,
      data: sizes,
   };
}

/**
 * Check current page is product type
 *
 * @returns Variant Or Simple
 */
async function get_product_type(page) {
   // Extract title
   const element = await page.$(".slicing-attributes");
   const element_content = await element.evaluate((e) => e.innerText);

   if (!element || element_content === "") {
      return constant.product_type.simple;
   }

   return constant.product_type.variant;
}

/**
 * Check if attribute size is available in current product page
 *
 * @returns boolean
 */
function evaluate_is_attribute_available_size() {
   const element = document.querySelector(".size-variant-wrapper");

   if (!element) {
      return false;
   }

   return true;
}

/**
 * Evaluate and extract current product description form details container
 *
 * @returns {string} Product description
 */
function evaluate_extract_product_description() {
   const description = document.querySelector(".detail-desc-list");

   if (!description) {
      return false;
   }

   return description.innerText;
}

/**
 * Evaluate and extract current product title form details container
 *
 * @returns {string} Product title
 */
function evaluate_extract_product_title() {
   const title = document.querySelector(".pr-new-br span");

   if (!title) {
      return false;
   }

   return title.innerText.trim();
}

/**
 * Evaluate and extract current product brand form details container
 *
 * @returns {string} Product brand
 */
function evaluate_extract_product_brand() {
   const brand = document.querySelector(".pr-new-br a");

   if (!brand) {
      return false;
   }

   return brand.innerText;
}

async function extract_product_attritubtes(page) {
   const data = {
      attributes: [],
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

   return data;
}

// Used to remove unnecessary elements in current page
async function remove_elements(page) {
   await page.waitForSelector("#onetrust-consent-sdk", {
      timeout: 30000,
   });

   await page.evaluate(() => {
      const removable_elements_selectors = [
         "#onetrust-consent-sdk",
         "#gender-popup-modal",
      ];

      removable_elements_selectors.forEach((selector) => {
         const element = document.querySelector(selector);

         if (element) {
            element.remove();
         }
      });

      document.body.classList = "";
   });

   await page.evaluate(() => {
      const attribute_sliders = document.querySelectorAll(".attributeSlider *");

      Array.from(attribute_sliders).forEach((slider) => {
         if (attribute_sliders) {
            slider.style.overflow = "visible";
         }
      });
   });
}
