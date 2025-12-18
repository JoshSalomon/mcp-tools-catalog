FROM registry.access.redhat.com/ubi9/nodejs-18:latest

ENV NODE_OPTIONS=--dns-result-order=ipv4first

WORKDIR /opt/app

USER root
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
RUN chown -R 1001:0 /opt/app

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080
USER 1001

CMD ["node", "server.js"]
