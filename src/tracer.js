"use strict";
const process = require("process");
const opentelemetry = require("@opentelemetry/sdk-node");
const {
   getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const {
   OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-http");
const { Resource } = require("@opentelemetry/resources");
const {
   SemanticResourceAttributes,
} = require("@opentelemetry/semantic-conventions");
const { trace } = require("@opentelemetry/api");

//Exporter
module.exports = (serviceName) => {
   const exporterOptions = {
      url:
         "http://" +
         process.env.OTEL_EXPORTER_OTLP_ENDPOINT +
         ":4318/v1/traces",
   };

   const traceExporter = new OTLPTraceExporter(exporterOptions);
   const sdk = new opentelemetry.NodeSDK({
      traceExporter,
      instrumentations: [getNodeAutoInstrumentations()],
      resource: new Resource({
         [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      }),
   });

   sdk.start();

   return trace.getTracer(serviceName);
};
