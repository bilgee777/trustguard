# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build \
  && node scripts/csp-hash.mjs dist/index.html > /tmp/theme-hash

# ---- Runtime stage: static files only, no Node.js ----
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /tmp/theme-hash /tmp/theme-hash
USER root
RUN sed -i "s|__THEME_SCRIPT_HASH__|$(cat /tmp/theme-hash)|" /etc/nginx/snippets/security-headers.conf && rm /tmp/theme-hash
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
