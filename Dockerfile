FROM node:18

ENV PUPPETEER_SKIP_DOWNLOAD=1

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# Copy .env file
# COPY .env ./

RUN npm install
# If you are building your code for production
# RUN npm ci --omit=dev

# Bundle app source
COPY . .

# # Environment variables

# ARG APP_ENV=${APP_ENV}

# # This project's static API key for authentication
# ARG AUTH_KEY_API=${AUTH_KEY_API}

# # Recaptcha solver API token
# ARG RECAPTCHA_API=${RECAPTCHA_API}

# # Browserless authentication token for websocket and http
# ARG BROWSERLESS_API=${BROWSERLESS_API}
# ARG BROWSERLESS_URL=${BROWSERLESS_URL}

# # ExpressJS Addresses
# ARG SERVER_PORT=${SERVER_PORT}
# ARG SERVER_HOST=${SERVER_HOST}

# # Open telemetery protocol
# ARG OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT}
# ARG OTEL_SERVICE_NAME=${OTEL_SERVICE_NAME}

# # Timezone for logs and more
# ARG TIMEZONE=${TIMEZONE}Asia/Tehran

# # Redis connection
# ARG REDIS_HOST=${REDIS_HOST}
# ARG REDIS_PASSWORD=${REDIS_PASSWORD}
# ARG REDIS_PORT=${REDIS_PORT}

# # Kharid express's laravel application base api url
# ARG KE_BASE_API_URL=${KE_BASE_API_URL}
# ARG KE_API_KEY=${KE_API_KEY}

EXPOSE 5000
CMD [ "npm", "start" ]