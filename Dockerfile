# syntax=docker/dockerfile:1

# ---- Build stage -----------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# Install dependencies first so this layer is cached while source changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The media origin is baked into the CSP at build time (see vite.config.ts).
# Defaults to the production origin so CI builds outside staging are unchanged.
ARG VITE_MEDIA_ORIGIN=https://media.littleworld.cloud
ENV VITE_MEDIA_ORIGIN=${VITE_MEDIA_ORIGIN}

RUN npm run build

# ---- Runtime stage --------------------------------------------------------
FROM nginx:stable AS runtime

# Pull Debian security fixes (including zlib) into the runtime layer instead of waiting for the
# mutable nginx:stable image tag to be refreshed.
RUN apt-get update \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/*

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["nginx", "-t"]
CMD ["nginx", "-g", "daemon off;"]
