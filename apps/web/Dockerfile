# SantexGo sayti (mijozlar uchun) image'i (Docker 23+ / BuildKit). Build loyiha ildizidan:
#   docker build -f apps/web/Dockerfile -t santexgo-web .
# Next.js "standalone" rejimi: faqat kerakli fayllar, node_modules'siz mustaqil server.

ARG NODE_VERSION=24
ARG DEBIAN_VERSION=bookworm

# ── 1. Monorepo'dan faqat shu ilova va unga kerakli paketlarni ajratib olish ──
FROM node:${NODE_VERSION}-${DEBIAN_VERSION}-slim AS prepare
WORKDIR /app
ENV TURBO_TELEMETRY_DISABLED=1 NPM_CONFIG_UPDATE_NOTIFIER=false
COPY . .
RUN npx --yes "turbo@$(node -p "require('./package.json').devDependencies.turbo")" \
      prune @santexgo/web --docker

# ── 2. Bog'liqliklar va build ──
FROM node:${NODE_VERSION}-${DEBIAN_VERSION}-slim AS builder
WORKDIR /app
ENV CI=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_STORE_DIR=/pnpm/store
COPY --from=prepare /app/out/json/ .
RUN npm install --global --no-fund --no-audit \
      "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir "$PNPM_STORE_DIR"
COPY --from=prepare /app/out/full/ .
# Build vaqtida kodga yoziladigan qiymatlar (o'zgarsa — image qayta build qilinadi)
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG API_INTERNAL_URL=http://api:4000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    API_INTERNAL_URL=$API_INTERNAL_URL
RUN pnpm turbo run build --filter=@santexgo/web && mkdir -p apps/web/public

# ── 3. Production server ──
FROM node:${NODE_VERSION}-${DEBIAN_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    API_INTERNAL_URL=http://api:4000
# Next.js keshi (.next) yozilishi uchun fayllar node foydalanuvchisiga tegishli
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/icon.svg').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
