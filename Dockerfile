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
FROM nginx:stable-alpine AS runtime

# Nginx needs writable cache, PID, and log directories when it runs as its
# unprivileged built-in user.
RUN mkdir -p /var/cache/nginx /var/run /var/log/nginx \
 && chown -R nginx:nginx /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html

COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx --from=build /app/dist /usr/share/nginx/html

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["nginx", "-t"]

CMD ["nginx", "-g", "daemon off;"]
