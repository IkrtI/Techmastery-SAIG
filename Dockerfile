# Multi-stage build (SPECS §10): build client + server, run a single Express
# origin that serves the API and the built SPA on :3000.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci -w server --omit=dev
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
EXPOSE 3000
# Seed manually after first deploy: node server/dist/scripts/seed.js
CMD ["node", "server/dist/index.js"]
