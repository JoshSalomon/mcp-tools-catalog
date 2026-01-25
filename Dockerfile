FROM registry.access.redhat.com/ubi9/nodejs-18:latest AS build
USER root

# Install yarn if not available
RUN command -v yarn || npm i -g yarn

# Copy package files first for better layer caching
COPY package.json yarn.lock* .yarnrc* ./
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json yarn.lock* .yarnrc* ./

# Configure yarn to prefer IPv4 to avoid IPv6 connectivity issues
# and increase network timeout
RUN yarn config set network-timeout 300000 && \
    yarn config set prefer-offline false

# Install dependencies
# If this fails with IPv6 errors, use Dockerfile.local instead
RUN yarn install --frozen-lockfile --network-concurrency 1 || \
    yarn install --network-concurrency 1

# Copy source code
COPY . .

# Build the application
RUN yarn build

FROM registry.access.redhat.com/ubi9/nginx-120:latest

COPY --from=build /usr/src/app/dist /opt/app-root/src
USER 1001

ENTRYPOINT ["nginx", "-g", "daemon off;"]