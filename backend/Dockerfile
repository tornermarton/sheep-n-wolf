### STAGE 1: Build ###
FROM node:16.15-alpine as development
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

### STAGE 2: Run ###
FROM node:16.15-alpine as production
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY --from=development /usr/src/app/dist ./dist
CMD ["node", "dist/main"]
