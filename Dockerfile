# syntax=docker/dockerfile:1

# deps sees only the manifests, so editing source reuses the cached `npm ci` layer.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Dev dependencies stay: the build needs TypeScript and Tailwind. They never reach the runner.
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No key is passed to the build and no ARG carries one: a build argument survives in
# `docker history`. The build needs none, because keys are read when a request arrives.
RUN npm run build
# The runner copies public/ by name, and a COPY of a missing directory fails the build.
RUN mkdir -p public

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The standalone server binds localhost unless told otherwise, so outside requests would hang.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Standalone output traces only imported modules; static assets and public/ are copied by hand.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 8080
CMD ["node", "server.js"]
