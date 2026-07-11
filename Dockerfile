# Build stage
FROM node:24-slim AS builder

WORKDIR /app

ENV NODE_ENV=development
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.33.0

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --reporter=append-only

COPY . .

RUN pnpm build


# Production stage
FROM node:24-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.33.0

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod --reporter=append-only

#в прод-образ кладём только собранный код; node_modules берём из прод-установки выше
#(все рантайм-зависимости в dependencies, devDependencies при запуске не нужны)
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]