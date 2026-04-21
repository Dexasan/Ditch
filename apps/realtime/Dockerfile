FROM node:20-alpine
RUN corepack enable

WORKDIR /repo

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/realtime/package.json ./apps/realtime/

RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/realtime/ ./apps/realtime/

WORKDIR /repo/apps/realtime

EXPOSE 3001
CMD ["pnpm", "start"]
