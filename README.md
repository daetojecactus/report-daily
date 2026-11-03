# Report Daily

Self-hosted bot that turns GitLab activity into daily work reports in Telegram. Slack support is planned.

Version 2 is under development. The previous version lives in the [`v1`](https://github.com/daetojecactus/report-daily/tree/v1) branch.

## Development

Requirements: Node.js 26, pnpm 12, Docker.

```bash
pnpm install
cp .env.example .env
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm watch
```

The application serves `GET /health/live` and `GET /health/ready` on port 3000.

| Command | What it does |
| --- | --- |
| `pnpm watch` | Build, run and restart on changes |
| `pnpm db:generate --name <name>` | Create a migration from schema changes |
| `pnpm db:migrate` | Apply migrations |
| `pnpm lint`, `pnpm typecheck` | Static checks |
| `pnpm test`, `pnpm test:int` | Unit and integration tests, integration tests need Docker |

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | | PostgreSQL connection URL |
| `REDIS_URL` | yes | | Redis connection URL |
| `LOG_LEVEL` | no | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `PORT` | no | `3000` | Port of the health endpoints |

## License

[Apache-2.0](LICENSE)
