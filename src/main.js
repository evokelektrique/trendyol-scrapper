const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockPlugin = require("puppeteer-extra-plugin-adblocker");
const global_args = require("./args.js");
const cookies = require("./cookies.js");

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockPlugin());

const { executablePath } = require("puppeteer");

const plugin_path = path.resolve("./plugin/js/config_ac_api_key.js"); // Convert relative to absolute path
// Set api key
const apiKey = "88d870b538df2079d9660fe97f8686c1";
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
      const browser = await puppeteer.launch({
         headless: false,
         executablePath: executablePath(),
         ignoreDefaultArgs: ["--disable-extensions", "--enable-automation"],
         args: global_args,
      });
      const pages = await browser.pages();
      const page = pages[0];

      // /**
      //  * Extract links
      //  */
      // const limit = 200;
      // let extracted_links = [];

      // for (let i = 0; i < urls.length; i++) {
      //    const url = urls[i];
      //    const links = await load_archive_page(page, url, limit);
      //    extracted_links.push(links);
      // }
      // extracted_links = extracted_links.flat(Infinity);
      // console.log(extracted_links, extracted_links.length);

      // /**
      //  * Extract product
      //  */
      // for (let i = 0; i < extracted_links.length; i++) {
      //    const url = base_url + extracted_links[i];

      //    const product = await load_product_page(page, url);
      //    console.log(product);
      // }
      const url =
         "https://www.trendyol.com/trendyolmilla/siyah-havuc-dokuma-yuksek-bel-poliviskon-pantolon-twoss22pl0280-p-213075655?boutiqueId=621840&merchantId=968";

      const product = await load_product_page(page, url);
      console.log(product);
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
   const data = {};
   await page.setCookie(...cookies);
   await page.goto(url, {
      waitUntil: "networkidle2",
   });

   await remove_elements(page);

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

   await remove_elements(page);

   // Extract links
   const links = [];
   let previousHeight;

   while (links.flat().length < limit) {
      const hrefs = await page.evaluate(extract_archive_hrefs);
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
function extract_archive_hrefs() {
   const tags = document.querySelectorAll(".p-card-wrppr a");
   const hrefs = [];

   Array.from(tags).forEach((anchor) => {
      hrefs.push(anchor.getAttribute("href"));
   });

   return hrefs;
}

// Used to remove unnecessary elements in current page
async function remove_elements(page) {
   page
      .waitForSelector("#onetrust-consent-sdk", {
         timeout: 30000,
      })
      .then(async () => {
         await page.evaluate(() => {
            const removable_elements_selectors = [
               "#onetrust-consent-sdk",
               "#gender-popup-modal",
            ];

            removable_elements_selectors.forEach((selector) => {
               const element = document.querySelector(selector);
               element.remove();
            });

            document.body.classList = "";
         });
         console.log("Removed elements");
      })
      .catch(() => {
         console.log("couldn't find banner");
      });
}
