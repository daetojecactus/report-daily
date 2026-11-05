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

Fill in `OWNER_TELEGRAM_IDS`, `TELEGRAM_BOT_TOKEN`, `GITLAB_URL` and `GITLAB_TOKEN` in `.env` first: use a separate test bot for development. The bot polls Telegram itself and needs no public address. The application serves `GET /health/live` and `GET /health/ready` on port 3000.

| Command | What it does |
| --- | --- |
| `pnpm watch` | Build, run and restart on changes |
| `pnpm db:generate --name <name>` | Create a migration from schema changes |
| `pnpm db:migrate` | Apply migrations |
| `pnpm preview <gitlab-username> <YYYY-MM-DD>` | Print what an employee did in GitLab on a day, grouped by project. Nothing is sent |
| `pnpm lint`, `pnpm typecheck` | Static checks |
| `pnpm test`, `pnpm test:int` | Unit and integration tests, integration tests need Docker |

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | | PostgreSQL connection URL |
| `REDIS_URL` | yes | | Redis connection URL |
| `APP_TIMEZONE` | yes | | Default time zone of employees, an IANA name such as `Asia/Almaty` |
| `OWNER_TELEGRAM_IDS` | yes | | Telegram user IDs of the owners, comma-separated. Owners have every permission |
| `TELEGRAM_BOT_TOKEN` | yes | | Bot token from @BotFather |
| `TELEGRAM_API_URL` | no | `https://api.telegram.org` | Bot API server, for example a self-hosted `telegram-bot-api` |
| `GITLAB_URL` | yes | | GitLab address without `/api/v4`, for example `https://gitlab.example.com` |
| `GITLAB_TOKEN` | yes | | Token of a GitLab service account with the `read_api` and `read_user` scopes |
| `LOG_LEVEL` | no | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `PORT` | no | `3000` | Port of the health endpoints |
| `NODE_EXTRA_CA_CERTS` | no | | Path to a PEM file with the CA certificate of a GitLab signed by a company CA. Not read from `.env`, see below |

## GitLab with a company certificate

If GitLab uses a certificate of an internal certificate authority, the bot reports that the GitLab certificate is not trusted. Give Node.js the CA certificate in `NODE_EXTRA_CA_CERTS`. TLS checks are never switched off.

Node.js reads this variable when the process starts, before `.env` is loaded with `--env-file`, so it has to be in the environment of the process:

- **Development:** start the bot with the variable: `NODE_EXTRA_CA_CERTS=/path/to/company-ca.pem pnpm watch`, and the same for `pnpm preview`.
- **Docker:** mount the file into the container and set `NODE_EXTRA_CA_CERTS` in the `environment` of the service.

## License

[Apache-2.0](LICENSE)
