FROM node:20-alpine
RUN corepack enable

WORKDIR /repo

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Install all deps (tsx is in dependencies, so --prod is fine; omit flag to also get devDeps for type stubs)
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

WORKDIR /repo/apps/api

EXPOSE 3002
CMD ["pnpm", "start"]
