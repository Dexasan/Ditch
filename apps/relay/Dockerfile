FROM node:20-alpine
RUN apk add --no-cache ffmpeg
RUN corepack enable

WORKDIR /repo

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/relay/package.json ./apps/relay/

RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/relay/ ./apps/relay/

WORKDIR /repo/apps/relay

EXPOSE 3003
CMD ["pnpm", "start"]
