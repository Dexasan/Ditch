FROM node:20-alpine

RUN apk add --no-cache ffmpeg

RUN npm install -g pnpm@9.0.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY apps/relay/ apps/relay/

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/relay

CMD ["pnpm", "start"]
