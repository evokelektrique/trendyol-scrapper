const { Worker, Queue, QueueEvents, Job } = require("bullmq");
const path = require("path");
const logger = require("../logger");
const axios = require("axios");

/**
 * Extract Archive worker and queue functions
 */
class ExtractReviewsQueueInstance {
   constructor() {
      this.queue_options = {
         // defaultJobOptions: {},
         connection: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            password: process.env.REDIS_PASSWORD,
         },
      };

      this.worker_options = {
         connection: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            password: process.env.REDIS_PASSWORD,
         },
         concurrency: 5,
         useWorkerThreads: true,
      };

      // Queue
      this.queue = new Queue("extract_reviews_queue", this.queue_options);

      // Queue event
      this.queueEvents = new QueueEvents("extract_reviews_queue", this.queue_options);

      // Worker
      const jobFile = path.join(__dirname, '../jobs/extractReviewsJob.js');
      this.worker = new Worker("extract_reviews_queue", jobFile, this.worker_options);

      // Queue events
      this.queueEvents.on("completed", async ({ jobId }) => {
         logger.info("JOB COMPLETED " + jobId);
         const job = await Job.fromId(this.queue, jobId);
         const data = job.returnvalue;

         const url = process.env.KE_BASE_API_URL + "/product/reviews/store";
         const privateKey = process.env.KE_API_KEY;
         const config = {
            headers: {
               PRIVATE_API_KEY: privateKey,
               "Content-Type": "application/json",
            },
         };
         logger.info(`Request POST: url(${url}) - ` + JSON.stringify(data));
         try {
            const response = await axios.post(url, data, config);
            logger.info(`Response: url(${url}) - ` + JSON.stringify(response.data));
         } catch (error) {
            logger.error("Error: " + error.message);
         }
      });
   }
};

module.exports = { ExtractReviewsQueueInstance };
