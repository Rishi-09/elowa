# syntax=docker/dockerfile:1

# Debian base rather than Alpine: argon2 publishes prebuilt binaries for
# glibc, so musl would force a source build of the native addon.
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Toolchain for argon2's node-gyp fallback if no prebuild matches this ABI.
# Only ever present in the build stages, never in the runtime image.
FROM base AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production dependency tree, resolved separately so the compiler and the
# @types/* packages never reach the final image.
FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# MEDIA_LOCAL_DIR defaults to ./var/media and is written at runtime, so it
# must exist and belong to the unprivileged user. Mount a volume here to keep
# locally stored media across container restarts.
RUN mkdir -p var/media && chown -R node:node var
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
