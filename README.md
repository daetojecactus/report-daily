# Report Daily

Self-hosted bot that turns GitLab activity into daily work reports in Telegram and Slack.

Version 2 is in development. Version 1 is kept in the [`v1`](https://github.com/daetojecactus/report-daily/tree/v1) branch.

## Features

- **Reports from real activity.** Merges, reviews, approvals, status and label changes, comments and pushes become short lines grouped by project, worded for the employee's role.
- **Telegram and Slack.** Each employee gets reports in one channel or both and talks to the bot in private messages.
- **On schedule or on demand.** Reports come at each employee's own time and time zone on days with activity; any of the last 14 days can be built on request.
- **Optional AI.** An OpenAI-compatible model can make the lines read naturally. It gets only the minimum of data, and a report never depends on it.
- **Templates.** The report layout is a [Liquid](https://liquidjs.com/tutorials/intro-to-liquid.html) template, personal or shared across the team.
- **Three access levels.** Owners run the bot, admins publish shared templates, employees see only their own reports.
- **Russian and English.**
- **Self-hosted, no inbound connections.** PostgreSQL and Redis run next to the bot; it reaches GitLab, Telegram, Slack and the AI service itself.

## Requirements

- Docker with Compose, or Node.js 26, PostgreSQL 18 and Redis 8.
- A GitLab token, see [GitLab](#gitlab).
- A Telegram bot, a Slack app, or both, see [Telegram](#telegram) and [Slack](#slack).
- Optionally, an OpenAI-compatible API, see [AI](#ai).

## Installation

```bash
git clone https://github.com/daetojecactus/report-daily.git
cd report-daily
cp .env.example .env
docker compose up -d --build
```

Fill in `.env` before the start, see [Configuration](#configuration). Compose starts PostgreSQL and Redis, applies the migrations and starts the bot; no port is published. `docker compose ps` shows the bot as healthy when it is up.

Before the team starts using the bot, check the reports on yourself: add yourself as an employee, and compare a few days in [`preview`](#preview) with GitLab.

To run without Docker, see [Running without Docker](#running-without-docker).

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `APP_TIMEZONE` | yes | | Default time zone of employees, an IANA name such as `Asia/Almaty` |
| `GITLAB_URL` | yes | | GitLab address without `/api/v4` |
| `GITLAB_TOKEN` | yes | | GitLab token, see [GitLab](#gitlab) |
| `TELEGRAM_BOT_TOKEN` | for Telegram | | Bot token |
| `OWNER_TELEGRAM_IDS` | for Telegram | | Telegram user IDs of the owners, comma-separated |
| `TELEGRAM_API_URL` | no | `https://api.telegram.org` | Bot API server, for example a self-hosted `telegram-bot-api` |
| `SLACK_BOT_TOKEN` | for Slack | | Bot token `xoxb-…` |
| `SLACK_APP_TOKEN` | for Slack | | App-level token `xapp-…` with the `connections:write` scope |
| `OWNER_SLACK_IDS` | for Slack | | Slack member IDs of the owners, comma-separated |
| `SLACK_API_URL` | no | `https://slack.com/api/` | Slack Web API address, for another Slack deployment |
| `LLM_BASE_URL` | no | | OpenAI-compatible API, for example `https://api.openai.com/v1` or a local `http://127.0.0.1:11434/v1`. AI is off unless the three `LLM_*` variables are set |
| `LLM_TOKEN` | no | | API key; a local server that needs none takes any value |
| `LLM_MODEL` | no | | Model name as the service calls it |
| `LLM_REQUESTS_PER_MINUTE` | no | `10` | AI requests a minute for all employees together, as the service tariff allows |
| `LLM_REQUESTS_PER_EMPLOYEE_PER_DAY` | no | `20` | Reports with AI of one employee a day; above it their reports go without AI until the next day (UTC) |
| `POSTGRES_PASSWORD` | with Compose | | Password of the PostgreSQL that Compose starts |
| `DATABASE_URL` | without Compose | | PostgreSQL connection URL; Compose sets it |
| `REDIS_URL` | without Compose | | Redis connection URL; Compose sets it |
| `REPORT_DAILY_VERSION` | no | `local` | Tag of the bot image in Compose |
| `LOG_LEVEL` | no | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`; `trace` also logs the text of every report |
| `PORT` | no | `3000` | Port of `GET /health/live` and `GET /health/ready` |

At least one channel is needed: Telegram, Slack or both. The variables of a channel are set together.

## Integrations

### GitLab

The bot reads GitLab and never writes to it.

- **Account.** A service account with the Reporter role in the groups the team works in. The bot sees only what this account sees.
- **Token scopes.** `read_api` and `read_user`.
- **Profiles.** Employees' GitLab profiles must be public: GitLab hides the activity of a private profile. The bot warns about it in the employee's card.

### Telegram

The bot polls Telegram, keeps each person's command menu in line with their access and answers only in private chats. It does not answer people who are not employees and shows them no menu; it writes their ID to the log, so an owner learns their own ID by writing to the bot and reading the log. Employees are bound by picking them in Telegram, no ID needed.

### Slack

The bot connects over Socket Mode and needs no public address.

- **App.** Create it from [`slack-manifest.yaml`](slack-manifest.yaml): the manifest sets Socket Mode, the scopes, direct messages and the `/report-daily` command. Reinstall the app after a change of the manifest.
- **Commands.** `/report-daily report`, `/report-daily settings` and so on, or the same words in the direct messages with the bot. The command name in the manifest must match `SLACK_SLASH_COMMAND` in the code.

### AI

Without AI the bot writes every line itself. With AI the model rewords the lines and keeps their meaning; a line it changed too much or did not return stays as the bot wrote it, and a failure of the service never breaks a report.

- AI is on for everyone once the three `LLM_*` variables are set; without them the bot shows no AI switches. The owner can switch it off for everyone in `/admin`, and each employee for themselves in `/settings`.
- The model gets the action phrase, the title and the type of each task; the employee's commit titles by default; excerpts of their own comments only if the owner allows it. Never: other people's comments, task descriptions, emails or tokens. An employee can keep their data out in `/settings`.
- A report of up to eight lines is one request; a longer one goes in parts of up to eight lines. Each request asks for at most 50 output tokens plus 100 a line. Set `LLM_REQUESTS_PER_MINUTE` to the service limit, and on a tariff that limits output tokens a minute keep it within that limit divided by 850: a request waits up to five minutes for a free slot, then the rest of the report goes without AI. `LLM_REQUESTS_PER_EMPLOYEE_PER_DAY` keeps one employee who rebuilds a report again and again from using up the limit of everyone.
- The model only writes text. It gets no tools and no access to the bot, its database or GitLab; the data it reads is never taken as instructions, and a line with a link the task title does not have stays as the bot wrote it.

## Usage

| Command | Who | What |
| --- | --- | --- |
| `/start` | employees and owners | Greeting |
| `/report` | employees | The report of today or one of the last 14 days, with "Rebuild" |
| `/settings` | employees | Language, report time and time zone, gender, scheduled report, AI, report template, channels |
| `/admin` | owners and admins | Management: everything for owners, shared templates for admins |
| `/help`, `/cancel` | everyone | The commands; leaving a dialog |

### Access

| Level | Who | Can |
| --- | --- | --- |
| Owner | The IDs in `OWNER_TELEGRAM_IDS` and `OWNER_SLACK_IDS` | Everything about running the bot: add, change, block and delete employees, bind and unbind their channels, "Report now", map labels in "Traits", pause scheduled reports, AI settings, broadcasts, make an employee an admin |
| Admin | An employee an owner marked as admin in the card | What an employee can, plus shared templates: create, edit, delete and make an own template shared |
| Employee | Anyone an owner added | Their own reports, settings and personal templates; which bound channels get reports and broadcasts |

Nobody sees another employee's report: owners see only whether the last one was delivered.

### Onboarding the team

1. Add yourself first and check your own reports with `/report` and [`preview`](#preview) against GitLab.
2. If the team's labels mean statuses, task types or priorities, map them in "Traits". Its "No traits" list shows the labels the bot met but does not understand.
3. In `/admin`, "Employees", add the employees found in GitLab and choose the role and the gender. The role shapes the wording; the gender, the Russian word forms.
4. Bind Telegram or Slack in each employee's card. In Telegram the employee opens the bot and presses Start; in Slack the bot writes first.

## Report templates

The built-in "Standard" template lists projects with their lines:

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

Any employee can write a personal template in `/settings`, "Report template"; owners and admins make shared ones in `/admin`, or make an own template shared from its card. The bot checks the syntax and shows a preview on the employee's latest report. A change of a shared template reaches everyone who picked it.

Templates produce Markdown: `**bold**`, `_italic_`, `` `code` `` and `[text](url)`. Data is escaped, so a title with `*` or `_` does not break the message; a link goes in as `[{{ item.title }}]({{ item.url | raw }})`. Templates run in a sandbox without file access and stop after one second of rendering.

| Field | Value |
| --- | --- |
| `context.date`, `context.dateText`, `context.weekday` | The day: `2026-11-09`, `9 November`, `Monday` in the report language |
| `context.user` | `name`, `username`, `role`, `roleName` |
| `context.isEmpty`, `context.itemsCount` | Whether the day has lines, and how many |
| `context.projects` | Projects with `name`, `url` and lines `items`, the more important first |
| `context.items` | All lines |
| `context.groups` | Lines by `category` with `name` and `items`: `outcome`, `check`, `transition`, `work`, `participation`, `context` |

A line (`item`) has `text` (the whole line), `actionText` (the phrase without the title), `note`, `title`, `action`, `details`, `secondary`, `category`, `kind`, `priority`, `state`, `type` (`issue`, `merge_request`, `push`, `event`, `summary`), `ref` (`#12`, `!5`), `url` and `projectName`.

Lines by category, with the date and links:

```liquid
**{{ context.dateText }}, {{ context.weekday }}**
{% for group in context.groups %}
_{{ group.name }}_
{% for item in group.items %}• {% if item.url %}[{{ item.actionText }}]({{ item.url | raw }}){% else %}{{ item.text }}{% endif %}
{% endfor %}{% endfor %}
```

## Operations

### Updating

Back up the database first: migrations only go forward.

```bash
git pull
docker compose up -d --build
```

### Backups

PostgreSQL holds everything that matters: employees and their access, settings, label mappings, templates and the reports of the last 30 days. Redis holds only short-lived state and needs no backup.

```bash
docker compose exec -T postgres pg_dump --username=report_daily --format=custom report_daily > report-daily.dump
docker compose exec -T postgres pg_restore --username=report_daily --clean --dbname=report_daily < report-daily.dump
```

### Preview

`preview` prints what an employee did in GitLab on a day and the report the bot would build. It sends nothing and keeps no report, so it is safe next to the running bot; like a real report, it adds the labels it meets to the "No traits" list.

```bash
docker compose exec app node dist/preview.js <gitlab-username> <YYYY-MM-DD> [--trace] [--lang=ru|en] [--ai] [--ai-comments]
```

`--trace` shows how each line was understood, `--lang` overrides the employee's language, `--ai` sends the lines to the AI service, and `--ai-comments` adds the comment excerpts as well.

### Running without Docker

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm start
```

`pnpm db:migrate` builds the application and applies the migrations. Run the bot under a process manager with restart, for example systemd:

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

To update, run `git pull`, `pnpm install --frozen-lockfile` and `pnpm db:migrate`, then restart the service. Without Compose, `preview` is `pnpm preview` with the same arguments, and backups are `pg_dump --format=custom --file=report-daily.dump "$DATABASE_URL"`.

On `SIGTERM` the bot stops taking new work and gives the running jobs up to 10 seconds per queue to finish; jobs that do not finish run again after the restart.

## Security

- **Network.** No incoming connections. Keep the health port, PostgreSQL and Redis closed to the outside; with Compose none of them is published.
- **Secrets** live only in `.env`, which must never be committed. Logs cut the Telegram, GitLab and AI tokens and never include the Slack tokens.
- **GitLab** is read with a read-only token.
- **Owners** control the bot through their Telegram or Slack accounts and should protect them with two-step verification.
- **Access** is checked on every action; the bot answers only in private chats.
- **Privacy.** Only the employee sees their report: owners see only whether the last one was delivered. The database keeps report texts for 30 days to answer `/report` again and to preview templates, so whoever can read the database or runs `preview` on the server can read them; the log has them only at `LOG_LEVEL=trace`.
- **AI** gets only the data listed in [AI](#ai).
- **Templates** run in a sandbox with size and time limits.

## Development

Node.js 26, pnpm 12 and Docker. Use a separate test bot or Slack workspace.

```bash
pnpm install
cp .env.example .env
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm watch
```

| Command | What it does |
| --- | --- |
| `pnpm watch` | Build, run and restart on changes |
| `pnpm db:generate --name <name>` | Create a migration from schema changes |
| `pnpm db:migrate` | Apply migrations |
| `pnpm preview …` | See [Preview](#preview) |
| `pnpm lint`, `pnpm typecheck`, `pnpm format` | Static checks and formatting |
| `pnpm test`, `pnpm test:int` | Unit and integration tests; integration tests need Docker |

## License

[Apache-2.0](LICENSE)
