# SantexGo API image'i (Docker 23+ / BuildKit). Build loyiha ildizidan:
#   docker build -f apps/api/Dockerfile -t santexgo-api .
# Bosqichlar:
#   migrate — migratsiya va seed uchun (prisma CLI va manba kodi bilan, bir martalik konteyner)
#   runner  — production API: faqat build natijasi va production bog'liqliklar, root'siz

ARG NODE_VERSION=24
ARG DEBIAN_VERSION=bookworm

# ── 1. Monorepo'dan faqat API va unga kerakli paketlarni ajratib olish ──
FROM node:${NODE_VERSION}-${DEBIAN_VERSION}-slim AS prepare
WORKDIR /app
ENV TURBO_TELEMETRY_DISABLED=1 NPM_CONFIG_UPDATE_NOTIFIER=false
COPY . .
# turbo versiyasi package.json'dan olinadi — lokal va Docker bir xil ishlaydi
RUN npx --yes "turbo@$(node -p "require('./package.json').devDependencies.turbo")" \
      prune @santexgo/api --docker

# ── 2. Bog'liqliklarni o'rnatish va build ──
# To'liq Debian image: Prisma migratsiya dvigateli uchun OpenSSL va CA sertifikatlari tayyor
FROM node:${NODE_VERSION}-${DEBIAN_VERSION} AS builder
WORKDIR /app
ENV CI=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    TURBO_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1 \
    PNPM_STORE_DIR=/pnpm/store
# Avval faqat package.json va lockfile — kod o'zgarsa ham bu qatlam keshdan olinadi
COPY --from=prepare /app/out/json/ .
RUN npm install --global --no-fund --no-audit \
      "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir "$PNPM_STORE_DIR"
COPY --from=prepare /app/out/full/ .
RUN pnpm turbo run build --filter=@santexgo/api

# ── 3. Migratsiya va seed (docker compose'dagi "migrate" xizmati) ──
FROM builder AS migrate
WORKDIR /app/apps/api
USER node
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ── 4. Faqat production bog'liqliklar (prisma CLI, tsx, testlarsiz) ──
FROM node:${NODE_VERSION}-${DEBIAN_VERSION}-slim AS prod-deps
WORKDIR /app
ENV CI=1 NPM_CONFIG_UPDATE_NOTIFIER=false PNPM_STORE_DIR=/pnpm/store
COPY --from=prepare /app/out/json/ .
RUN npm install --global --no-fund --no-audit \
      "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --store-dir "$PNPM_STORE_DIR"
# @prisma/client ixtiyoriy peer sifatida tortgan prisma CLI va TypeScript'ni olib tashlash (~400 MB)
COPY --from=prepare /app/out/full/apps/api/docker/prune-runtime-deps.mjs /tmp/
RUN node /tmp/prune-runtime-deps.mjs /app

# ── 5. Production API ──
FROM node:${NODE_VERSION}-${DEBIAN_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    STORAGE_LOCAL_DIR=/app/apps/api/uploads
# Kod root'ga tegishli (o'zgartirib bo'lmaydi); yozish faqat uploads papkasiga
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
RUN mkdir -p /app/apps/api/uploads && chown node:node /app/apps/api/uploads
WORKDIR /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
