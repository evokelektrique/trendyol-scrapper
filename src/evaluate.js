class Evaluate {
   // Used to evaluate page hrefs
   static evaluate_extract_archive_hrefs() {
      const tags = document.querySelectorAll(".p-card-wrppr a");
      const hrefs = [];

      Array.from(tags).forEach((anchor) => {
         hrefs.push(anchor.getAttribute("href"));
      });

      return hrefs;
   }

   static evaluate_extract_product_images() {
      const image_elements = document.querySelectorAll(
         ".gallery-container .product-slide img"
      );
      const image_sources = [];
      Array.from(image_elements).forEach((element) => {
         image_sources.push(element.src.replace("mnresize/128/192/", ""));
      });

      return image_sources;
   }

   static evaluate_extract_product_properties() {
      const wrapper = document.querySelector(".detail-attr-container");
      if (!wrapper) {
         return [];
      }
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
   static evaluate_extract_product_price() {
      const wrapper = document.querySelector(".container-right-content");
      let regular_price = null;
      let featured_price = null;

      const is_featured_price = wrapper.querySelector(".featured-price-box");
      if (is_featured_price) {
         regular_price = is_featured_price.querySelector(".prc-org");
         if (regular_price) {
            regular_price = regular_price.innerText
         }

         featured_price = is_featured_price.querySelector(".prc-dsc");
         if (featured_price) {
            featured_price = featured_price.innerText
         }

         return {
            regular: regular_price,
            featured: featured_price,
         };
      }

      regular_price = wrapper.querySelector(".product-price-container");
      if (regular_price) {
         regular_price = regular_price.innerText
      }

      return {
         regular: regular_price,
         featured: null, // It's always empty, because we don't calculate the featured price right now
      };
   }

   /**
    * Check if attribute size is available in current product page
    *
    * @returns boolean
    */
   static evaluate_is_attribute_available_size() {
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
   static evaluate_extract_product_description() {
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
   static evaluate_extract_product_title() {
      const title = document.querySelector(".pr-new-br");

      if (!title) {
         return false;
      }

      return title.innerText.trim();
   }

   static evaluate_extract_product_size_variants() {
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

   static evaluate_extract_product_other_variants() {
      const wrapper = document.querySelector(".container-right-content");
      // const items = wrapper.querySelectorAll(".sp-itm:not(.so)");
      // const title = wrapper
      //    .querySelector(".size-variant-title--bold")
      //    .innerText.trim()
      //    .toLowerCase();
      // const sizes = [];

      // Array.from(items).forEach((items) => {
      //    sizes.push(items.innerText.trim().toLowerCase());
      // });

      const other_attributes = wrapper.querySelectorAll('[class*="-variant-wrapper"]');
      const data = [];

      for (let index = 0; index < other_attributes.length; index++) {
         const other_attribute = other_attributes[index];

         const other_attribute_content = other_attribute.innerText;

         if (other_attribute_content === "") {
            continue;
         }

         // Extract items
         const attribute_items = [];
         Array.from(other_attribute.querySelectorAll(".sp-itm:not(.so)")).forEach(item => {
            attribute_items.push(item.innerText.trim().toLowerCase());
         })

         // Extract title
         const attribute_title = other_attribute
            .querySelector("[class*='-variant-title--bold']")
            .innerText.replaceAll(":", "")
            .trim()
            .toLowerCase();

         data.push({
            title: attribute_title,
            data: attribute_items,
         });
      }

      return data;
   }

   /**
    * Evaluate and extract current product brand form details container
    *
    * @returns {string} Product brand
    */
   static evaluate_extract_product_brand() {
      const brand_span = document.querySelector(".pr-new-br > span");
      const brand_a = document.querySelector(".pr-new-br > a");
      const brand = brand_span || brand_a;

      if (!brand) {
         return false;
      }

      return brand.innerText;
   }

   static evaluate_change_product_variation_sliders() {
      const attribute_sliders = document.querySelectorAll(".attributeSlider *");

      Array.from(attribute_sliders).forEach((slider) => {
         if (attribute_sliders) {
            slider.style.overflow = "visible";
            slider.style.zIndex = 9999999;
            slider.style.position = 'relative';
         }
      });
   }

   static evaluate_remove_elements() {
      const removable_elements_selectors = [
         "#onetrust-consent-sdk",
         "#gender-popup-modal",
         ".onboarding"
      ];

      removable_elements_selectors.forEach((selector) => {
         const element = document.querySelector(selector);

         if (element) {
            element.remove();
         }
      });

      document.body.classList = "";
   }

   /**
    * Retrieve if product is in stock/available to purchase or not.
    * 
    * @returns {Boolean} Product availability
    */
   static evaluate_get_product_availability() {
      const product_button_container = document.querySelector('.product-button-container');
      const sold_out_button = product_button_container.querySelector('.sold-out');
      const add_to_basket_button = product_button_container.querySelector('.add-to-basket');

      if (add_to_basket_button) {
         return [product_button_container, add_to_basket_button, sold_out_button];
         return true;
      }

      // If button is available in product_button_container,
      // this product is sold out so return false
      if (sold_out_button === undefined) {
         return false;
      }

      return true;
   }
}

module.exports = Evaluate;
