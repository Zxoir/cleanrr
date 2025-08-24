# =========================
# Builder
# =========================
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# install all deps (incl. dev) with cache
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# build
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# prune to production deps only
RUN npm prune --omit=dev

# =========================
# Runtime
# =========================
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV WHATSAPP_SESSION_PATH=/app/session

# security: non-root
RUN useradd --user-group --create-home --shell /bin/false appuser
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/zxoir/cleanrr" \
      org.opencontainers.image.title="Cleanrr Bot" \
      org.opencontainers.image.description="WhatsApp Overseerr reminder bot" \
      org.opencontainers.image.licenses="MIT"

# copy pruned node_modules + package metadata + build output
COPY --chown=appuser:appuser package*.json ./
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/dist ./dist

# entrypoint for pre-start cleanup based on marker file
COPY --chown=appuser:appuser entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# prepare writable dirs
RUN mkdir -p /app/session /app/data && chown -R appuser:appuser /app

USER appuser
EXPOSE 3000

# Entry: clears session if .RESET exists, then execs Node
ENTRYPOINT ["/app/entrypoint.sh"]