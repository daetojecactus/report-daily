# Report Daily

Self-hosted bot that turns GitLab activity into daily work reports in Telegram and Slack.

Version 2 is under development. The previous version lives in the [`v1`](https://github.com/daetojecactus/report-daily/tree/v1) branch.

## What it does

Every employee gets a report of their GitLab day in Telegram, Slack or both: on their own at the time they chose, on days with activity, or on demand for any of the last 14 days. A line comes from what the employee did: merges, reviews, status and label changes, comments, pushes. An OpenAI-compatible model can reword the lines; without it the bot writes them itself.

| Command | Who | What |
| --- | --- | --- |
| `/start` | everyone | Greets an employee or an owner; tells anyone else their Telegram or Slack ID to pass to the owner |
| `/report` | employees | The report of today, yesterday or another day of the last 14, with «Rebuild» |
| `/settings` | employees | Language, report time and time zone, gender, scheduled report on or off, AI, report template; with two channels, which of them get reports and broadcasts |
| `/admin` | owners and admins | The sections their permissions open; «Broadcast» for owners |
| `/help`, `/cancel` | everyone | The commands; leaving a dialog |

In Slack these are words after one command, `/report-daily report`, or the same words in the direct messages with the bot: `report`, `settings`. The bot answers in the direct messages.

The owners are the IDs in `OWNER_TELEGRAM_IDS` and `OWNER_SLACK_IDS`: they can do everything, grant permissions and send broadcasts. An owner makes an employee an admin by granting permissions in the employee's card:

| Permission | Opens |
| --- | --- |
| `users` | Employees: add, bind Telegram or Slack, change, block, delete, «Report now» |
| `traits` | Mapping GitLab labels and statuses to the bot's traits |
| `settings` | The pause of scheduled reports and the AI settings |
| `templates` | Shared report templates |

## Development

Requirements: Node.js 26, pnpm 12, Docker.

```bash
pnpm install
cp .env.example .env
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm watch
```

Fill in `GITLAB_URL`, `GITLAB_TOKEN` and at least one channel in `.env` first: `OWNER_TELEGRAM_IDS` and `TELEGRAM_BOT_TOKEN` for Telegram, the three Slack variables for [Slack](#slack). Use a separate test bot or Slack workspace for development. The bot polls Telegram and connects to Slack itself, so it needs no public address. The application serves `GET /health/live` and `GET /health/ready` on port 3000.

| Command | What it does |
| --- | --- |
| `pnpm watch` | Build, run and restart on changes |
| `pnpm start` | Run the built application, see [Running on a server](#running-on-a-server) |
| `pnpm db:generate --name <name>` | Create a migration from schema changes |
| `pnpm db:migrate` | Apply migrations |
| `pnpm preview <gitlab-username> <YYYY-MM-DD> [--trace] [--lang=ru\|en] [--ai]` | Print what an employee did in GitLab on a day and the report. Nothing goes to Telegram or Slack; with `--ai` the lines go to the AI service |
| `pnpm lint`, `pnpm typecheck` | Static checks |
| `pnpm format` | Format TypeScript files with Prettier |
| `pnpm test`, `pnpm test:int` | Unit and integration tests, integration tests need Docker |

## Running on a server

The bot needs outgoing access to GitLab, to Telegram or Slack and, if you use it, to the AI service. It needs no incoming connections: it polls Telegram and connects to Slack over Socket Mode itself.

### With Docker Compose

Requirements: Docker with Compose.

```bash
git clone https://github.com/daetojecactus/report-daily.git
cd report-daily
cp .env.example .env
docker compose up -d --build
```

Fill in `.env` first, see [Environment variables](#environment-variables), and set `POSTGRES_PASSWORD`. Compose starts PostgreSQL and Redis next to the bot and sets `DATABASE_URL` and `REDIS_URL` itself. The `migrate` service applies the migrations and exits, then `app` starts. No port is published: `docker compose ps` shows `app` as healthy when the bot is up, and `docker compose logs -f app` shows its log. The image is built from the source and tagged `ghcr.io/daetojecactus/report-daily:local`; `REPORT_DAILY_VERSION` changes the tag. The bot runs as an unprivileged user, and Compose gives it 45 seconds to stop.

### Without Docker

Requirements: Node.js 26, pnpm 12, PostgreSQL 18 and Redis 8.

```bash
git clone https://github.com/daetojecactus/report-daily.git
cd report-daily
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:migrate
pnpm start
```

Fill in `.env` first, see [Environment variables](#environment-variables). `pnpm db:migrate` builds the application and applies the migrations, `pnpm start` runs it. Keep it running under a process manager with automatic restart, for example a systemd service. It calls Node.js directly, since a service may not have pnpm in its `PATH`; `which node` gives the path:

```ini
[Unit]
Description=Report Daily
After=network-online.target postgresql.service redis.service

[Service]
WorkingDirectory=/opt/report-daily
ExecStart=/usr/bin/node --env-file=.env dist/main.js
Restart=always
TimeoutStopSec=45

[Install]
WantedBy=multi-user.target
```

On `SIGTERM` the bot stops polling and lets the running jobs finish, so give it about 45 seconds to stop.

Before the team starts using the bot, check it on yourself: set `DELIVERY_MODE=redirect`, and scheduled reports and «Report now» go to the owners with a line saying whom they were for, and a broadcast comes to the owners as one copy. In `/admin` → «Settings» scheduled reports can also be paused for everyone.

## Slack

The bot works in Slack, in Telegram or in both. In Slack it needs no public address: it connects over Socket Mode.

1. At <https://api.slack.com/apps> press **Create New App** → **From an app manifest**, pick the workspace and paste [`slack-manifest.yaml`](slack-manifest.yaml). The manifest turns on Socket Mode, the `/report-daily` command, direct messages with the bot and its scopes.
2. **Install App** → **Install to Workspace**. The **Bot User OAuth Token** (`xoxb-…`) goes to `SLACK_BOT_TOKEN`.
3. **Basic Information** → **App-Level Tokens** → **Generate Token and Scopes** with the `connections:write` scope. The token (`xapp-…`) goes to `SLACK_APP_TOKEN`.
4. The member IDs of the owners go to `OWNER_SLACK_IDS`: profile → **⋮** → **Copy member ID**.
5. Restart the bot and type `/report-daily` anywhere in Slack: the answer comes in the direct messages with the bot.

An admin binds an employee's Slack in the employee's card: **Bind Slack**, then the member picker in Slack or the member ID from Telegram. Each channel is bound the same way. An employee with Telegram and Slack picks in `/settings` which of them get scheduled reports and broadcasts.

The command name is set in two places that must match: the manifest and `SLACK_SLASH_COMMAND` in the code, from which the bot writes the command in its texts.

After a change of the manifest, reinstall the app: new scopes work only after that. If Slack refuses messages in the direct messages with the bot, reload Slack: it keeps the old settings of the app for a while.

## Updating

Back up the database before an update: migrations only go forward.

```bash
git pull
docker compose up -d --build
```

Without Docker:

```bash
git pull
pnpm install --frozen-lockfile
pnpm db:migrate
```

Then restart the service.

## Backups

PostgreSQL holds everything that matters: employees and their permissions, settings, label mappings, templates and the reports of the last 30 days. Back it up every day:

```bash
docker compose exec -T postgres pg_dump --username=report_daily --format=custom report_daily > report-daily.dump
docker compose exec -T postgres pg_restore --username=report_daily --clean --dbname=report_daily < report-daily.dump
```

Without Docker:

```bash
pg_dump --format=custom --file=report-daily.dump "$DATABASE_URL"
pg_restore --clean --dbname="$DATABASE_URL" report-daily.dump
```

Redis holds only short-lived state: open dialogs, queued messages and caches. It needs no backup; after losing it, open dialogs start over and messages still in the queue are lost.

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes, Compose sets it | | PostgreSQL connection URL |
| `REDIS_URL` | yes, Compose sets it | | Redis connection URL |
| `POSTGRES_PASSWORD` | with Compose | | Password of the PostgreSQL that Compose starts |
| `REPORT_DAILY_VERSION` | no | `local` | Tag of the bot image in Compose |
| `APP_TIMEZONE` | yes | | Default time zone of employees, an IANA name such as `Asia/Almaty` |
| `OWNER_TELEGRAM_IDS` | for Telegram | | Telegram user IDs of the owners, comma-separated. Owners have every permission. Set together with `TELEGRAM_BOT_TOKEN`; at least Telegram or Slack is needed |
| `TELEGRAM_BOT_TOKEN` | for Telegram | | Bot token from @BotFather |
| `TELEGRAM_API_URL` | no | `https://api.telegram.org` | Bot API server, for example a self-hosted `telegram-bot-api` |
| `SLACK_BOT_TOKEN` | for Slack | | Bot token `xoxb-…`, see [Slack](#slack). Set together with `SLACK_APP_TOKEN` and `OWNER_SLACK_IDS` |
| `SLACK_APP_TOKEN` | for Slack | | App-level token `xapp-…` with the `connections:write` scope |
| `OWNER_SLACK_IDS` | for Slack | | Slack member IDs of the owners, comma-separated |
| `GITLAB_URL` | yes | | GitLab address without `/api/v4`, for example `https://gitlab.example.com` |
| `GITLAB_TOKEN` | yes | | Token of a GitLab service account with the `read_api` and `read_user` scopes |
| `LLM_BASE_URL` | no | | Address of an OpenAI-compatible API, for example `https://api.openai.com/v1`, `https://openrouter.ai/api/v1` or a local `http://127.0.0.1:11434/v1` (Ollama). Set together with `LLM_TOKEN` and `LLM_MODEL`; without the three, AI is off |
| `LLM_TOKEN` | no | | API key of that service. A local server that needs none takes any value |
| `LLM_MODEL` | no | | Model name as the service calls it |
| `DELIVERY_MODE` | no | `live` | `live`, or `redirect` to check the bot before the team uses it: scheduled reports and «Report now» go to the owners with a line saying whom they were for, and nothing reaches the employees. An employee's own `/report` is answered as usual |
| `LOG_LEVEL` | no | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `PORT` | no | `3000` | Port of the health endpoints |
| `NODE_EXTRA_CA_CERTS` | no | | Path to a PEM file with the CA certificate of a GitLab signed by a company CA. Not read from `.env`, see below |

## Security

- **Network.** The bot accepts no incoming connections. Keep the health port closed to the outside, and PostgreSQL and Redis password-protected and reachable only from the bot's host. With Compose none of them publishes a port: PostgreSQL and Redis are reachable only from the bot's containers.
- **Secrets** live only in `.env`, which must never be committed. Logs cut tokens: the Telegram token, the GitLab token header and the AI key; the bot does not log the Slack tokens.
- **GitLab token.** Use a service account with the `read_api` and `read_user` scopes only. The bot never writes to GitLab.
- **TLS** is always checked. For a company certificate authority see the next section.
- **Owners.** Whoever controls an owner's Telegram or Slack account controls the bot, so owners should turn on two-step verification there.
- **Access.** Permissions are checked on every action, and the bot answers only in private chats: in Slack, in the direct messages with the bot.
- **Privacy.** Only the employee sees the text of their report; admins see the status of the last report. The exception is `DELIVERY_MODE=redirect`, switched on on purpose to check the bot.
- **AI** gets the action phrase, the title and the type of the task and, if «Settings» allow, the employee's own commit titles and excerpts of their own comments of the day. It never gets other people's comments, task descriptions, emails or tokens. An employee can switch AI off or keep their data out of it in `/settings`, and the owner can switch it off for everyone. A failure of the AI never breaks a report.
- **Templates** run in a sandbox: no file access, only the report data, and limits on size and rendering time.

## GitLab with a company certificate

If GitLab uses a certificate of an internal certificate authority, the bot reports that the GitLab certificate is not trusted. Give Node.js the CA certificate in `NODE_EXTRA_CA_CERTS`. TLS checks are never switched off.

Node.js reads this variable when the process starts, before `.env` is loaded with `--env-file`, so it has to be in the environment of the process:

- **Development:** start the bot with the variable: `NODE_EXTRA_CA_CERTS=/path/to/company-ca.pem pnpm watch`, and the same for `pnpm preview`.
- **Docker Compose:** mount the file into the container in `compose.override.yaml`, which Compose reads next to `compose.yaml`:

  ```yaml
  services:
    app:
      volumes:
        - ./company-ca.pem:/etc/ssl/company-ca.pem:ro
      environment:
        NODE_EXTRA_CA_CERTS: /etc/ssl/company-ca.pem
  ```

## Your own templates

Reports come in the built-in «Standard» template: projects with their lines. Any employee can write their own template in the bot: `/settings` → «Report template» → «My templates» → «Create». The bot asks for a name and the text, checks the syntax and shows a preview on your latest report. The template card has «Edit text» and «Rename». The owner and employees with the «Templates» permission make shared templates in `/admin` → «Templates»: everyone can pick them, and a change reaches everyone who picked one. Templates are written in [Liquid](https://liquidjs.com/tutorials/intro-to-liquid.html) and produce Markdown: `**bold**`, `_italic_`, `` `code` `` and `[text](url)`.

Everything taken from the data is escaped for Markdown, so a task title with `*` or `_` does not break the message. A link from the data goes in without escaping: `[{{ item.title }}]({{ item.url | raw }})`. Links point only to your GitLab. A template cannot read files and stops after one second of rendering.

The data is in `context`:

| Field | What it is |
|---|---|
| `context.date`, `context.dateText`, `context.weekday` | The day: `2026-11-09`, «9 ноября», «понедельник» in the report language |
| `context.user` | `name`, `username`, `role`, `roleName` |
| `context.isEmpty`, `context.itemsCount` | Whether the day has lines, and how many |
| `context.projects` | Projects with `name`, `url` and their lines `items`, the more important first |
| `context.items` | All lines |
| `context.groups` | Lines by `category`: `outcome`, `check`, `transition`, `work`, `participation`, `context`; with `name` and `items` |

A line (`item`) has:
- `text`: the whole line, for example «Fixed a bug after testing "Login form"»;
- `actionText`: the phrase without the title;
- `note`, `title`;
- `action`, `details` and `secondary` (other actions of the line);
- `category`, `kind`, `priority`, `state`;
- `type`: `issue`, `merge_request`, `push`, `event` or `summary`;
- `ref` (`#12`, `!5`), `url`, `projectName`.

The «Standard» template:

```liquid
{%- for project in context.projects -%}
{{ project.name }}:
{%- for item in project.items %}
• {{ item.text }}
{%- endfor %}
{%- unless forloop.last %}

{% endunless -%}
{%- endfor -%}
```

Lines by category, with the date and links:

```liquid
**{{ context.dateText }}, {{ context.weekday }}**
{% for group in context.groups %}
_{{ group.name }}_
{% for item in group.items %}• {% if item.url %}[{{ item.actionText }}]({{ item.url | raw }}){% else %}{{ item.text }}{% endif %}
{% endfor %}{% endfor %}
```

## License

[Apache-2.0](LICENSE)
