# Pulse Analytics container image.
#
# Stage 1 (builder) installs all dependencies with pnpm and runs the full
# Pulse build. Stage 2 (runner) copies the built application, reinstalls
# production dependencies only, and starts the app after the database
# setup step has run.
#
# Node 22 matches the version used in CI (.github/workflows/pulse-ci.yml)
# and the README requirement of Node.js 20.19+ with 22 LTS recommended.
# pnpm 12.3.4 matches the engines field in package.json.

FROM node:22-bookworm-slim AS builder

# Prisma needs OpenSSL present when it generates its client and engines.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

WORKDIR /app

COPY . .

# The build normally checks the database (scripts/check-db.js) in the
# middle of the build. There is no database during an image build, so the
# check is skipped here and run at container start instead, where it also
# applies migrations. The placeholder DATABASE_URL only exists so Prisma
# can generate its client; it is not used to connect to anything.
ENV SKIP_DB_CHECK=1 \
  DATABASE_URL=postgresql://pulse:pulse@db:5432/pulse \
  NEXT_TELEMETRY_DISABLED=1 \
  DISABLE_TELEMETRY=1

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

WORKDIR /app

COPY --from=builder /app ./

# Reinstall with production dependencies only, so build and test tooling
# from the builder stage does not stay in the final image.
RUN pnpm install --frozen-lockfile --prod \
  && chown -R node:node /app

USER node

ENV NODE_ENV=production \
  PORT=3000 \
  HOSTNAME=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Startup sequence, using the repository's own scripts:
# 1. scripts/check-db.js verifies DATABASE_URL, connects, checks the
#    PostgreSQL version and applies migrations (prisma migrate deploy).
# 2. scripts/update-tracker.js rewrites the tracker endpoint when
#    COLLECT_API_ENDPOINT is set, and does nothing otherwise.
# 3. next start serves the application on PORT (3000).
CMD ["/bin/sh", "-c", "export PATH=\"/app/node_modules/.bin:$PATH\"; node scripts/check-db.js && node scripts/update-tracker.js && exec ./node_modules/.bin/next start"]
