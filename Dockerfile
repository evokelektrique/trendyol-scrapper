FROM node:18

ENV PUPPETEER_SKIP_DOWNLOAD=1

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensue both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Environment variables
ARG APP_ENV=production
# ExpressJS Addresses
ARG SERVER_PORT=5000
ARG SERVER_HOST=0.0.0.0

EXPOSE 5000
CMD [ "npm", "start" ]