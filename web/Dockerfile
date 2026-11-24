# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f web/Dockerfile .
# The web app imports the engine rules from shared/, which lives outside web/.

# ---- Build stage ----
FROM node:26-alpine AS build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
COPY shared/ /app/shared/
RUN npm run build \
  && node scripts/csp-hash.mjs dist/index.html > /tmp/theme-hash

# ---- Runtime stage: static files and a reverse proxy to the API. No Node.js. ----
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /tmp/theme-hash /tmp/theme-hash
USER root
RUN sed -i "s|__THEME_SCRIPT_HASH__|$(cat /tmp/theme-hash)|" /etc/nginx/snippets/security-headers.conf && rm /tmp/theme-hash
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
