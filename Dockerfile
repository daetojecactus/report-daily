FROM node:26.13.0-alpine3.24 AS build
RUN npm install --global pnpm@12.16.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM node:26.13.0-alpine3.24
ENV NODE_ENV=production
WORKDIR /app
COPY LICENSE ./
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT:-3000}/health/live" || exit 1
CMD ["node", "--enable-source-maps", "dist/main.js"]
