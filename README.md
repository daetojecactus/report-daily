# Report Daily Bot

Telegram bot for automated daily work reports. Collects activity from **GitLab** (commits, merge requests, issues), processes it with **AI** (OpenRouter / Groq), and delivers formatted reports via Telegram.

## Features

- **Scheduled reports** — cron job checks hourly who needs a report, dispatches via BullMQ queue
- **On-demand reports** — users can request a report at any time via `/send_report`
- **AI-enhanced text** — task descriptions are refined using OpenRouter or Groq with automatic provider fallback
- **Report templates** — Standard (grouped by project) and QA (grouped by activity: reviews, bugs, tests)
- **Localization** — Russian and English (i18n), per-user language setting with live command menu updates
- **User management** — add, block, update roles and settings via Telegram commands
- **Role-aware reports** — content adapts to user role (Developer, QA, Project Manager) and gender
- **Production calendar** — automatic holiday/weekend detection (parsed from external API)
- **Dual transport** — long polling for development, webhook for production

## Tech Stack

| Component       | Technology                            |
| --------------- | ------------------------------------- |
| Framework       | NestJS 11                             |
| Language        | TypeScript 5.7                        |
| Database        | MongoDB (Mongoose 9)                  |
| Queue           | Redis + BullMQ                        |
| Telegram        | Bot API (custom axios client)         |
| AI              | OpenRouter (OpenAI SDK) + Groq SDK    |
| GitLab          | GitLab REST API v4                    |
| Scheduler       | @nestjs/schedule (cron)               |
| Runtime         | Node.js 22                            |
| Package Manager | pnpm 8.10                             |
| Container       | Docker (multi-stage) + docker-compose |

## Architecture

```
src/
├── common/             # Shared utilities, enums, helpers, i18n
├── modules/
│   ├── api/            # Controllers (Telegram webhook, HTTP endpoints)
│   │   ├── report/     # Bot command setup via API
│   │   └── telegram/   # Webhook controller + polling service + command router
│   ├── application/    # Business logic
│   │   ├── ai/         # AI providers (OpenRouter, Groq) with fallback
│   │   ├── bot-command/ # Command handling (admin + user)
│   │   ├── bot-settings/ # Global bot settings
│   │   ├── holiday-calendar/ # Production calendar
│   │   ├── report/     # Report generation
│   │   │   ├── git-report/ # GitLab data collection, grouping, mapping
│   │   │   └── report-template/ # Report formatting (Standard / QA templates)
│   │   ├── scheduler/  # Cron-based report dispatch
│   │   └── user/       # User management and settings
│   ├── config/         # Environment validation + app config module
│   ├── database/       # MongoDB connection
│   ├── queue/          # BullMQ — report producer + consumer
│   ├── tasks/          # Scheduled tasks (calendar sync, report dispatch)
│   └── vendors/        # External integrations (Telegram, GitLab, Groq, OpenRouter, Portal)
└── types/
```

### Report Queue (BullMQ)

Mass report delivery runs through a Redis queue:

- **Concurrency**: 5 parallel workers
- **Rate limit**: 20 messages/sec (Telegram API constraint)
- **Retry**: 3 attempts with exponential backoff (3s → 6s → 12s)
- **Cleanup**: successful jobs removed, failed jobs retained for 24 hours

### Report Generation Pipeline

1. **GitGroupService** — fetches GitLab events (issues, MRs, pushes), groups by issue, extracts standalone MRs and pushes
2. **GitMapperService** — determines user role (assignee, reviewer, author), computes `TaskStatus` based on role (Developer/QA/PM), task type, and labels
3. **ReportService** — builds report text (with or without AI), applies template (Standard/QA)
4. **TelegramService** — delivers the formatted report to the user

## Bot Commands

### User Commands

| Command               | Description                  |
| --------------------- | ---------------------------- |
| `/info`               | Show current settings        |
| `/send_report`        | Get today's report           |
| `/toggle_ai`          | Toggle AI processing         |
| `/change_report_hour` | Change automatic report hour |
| `/language`           | Switch language (RU / EN)    |
| `/help`               | List available commands      |

### Admin Commands (Owner)

| Command             | Description                    |
| ------------------- | ------------------------------ |
| `/add_user`         | Add user (step-by-step wizard) |
| `/update_user`      | Update user settings           |
| `/block_user`       | Block a user                   |
| `/unblock_user`     | Unblock a user                 |
| `/user_info`        | View user details              |
| `/list_users`       | List all users                 |
| `/send_user_report` | Send report to a specific user |

## Environment Variables

Create a `.env` file in the project root:

```env
# App
PORT=3000
TZ=Asia/Aqtau

# GitLab
GITLAB_API_URL=https://gitlab.example.com/api/v4
GITLAB_API_TOKEN=your_gitlab_private_token

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_BOT_SECRET_TOKEN=your_webhook_secret    # optional, for webhook mode
TELEGRAM_TRANSPORT=polling                        # polling | webhook
OWNER_TELEGRAM_ID=123456789                       # admin Telegram ID

# AI — OpenRouter
OPENROUTER_API_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.0-flash-001

# AI — Groq (fallback)
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

# Portal (Bitrix24)
PORTAL_WEBHOOK_URL=https://your-portal.bitrix24.kz/rest/.../...

# Production Calendar
PRODUCTION_CALENDAR_BASE_URL=https://production-calendar.example.com

# Database
MONGODB_URI=mongodb://localhost:27017/report-daily-bot

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 8.10+
- Docker (for Redis)
- MongoDB instance
- Filled `.env` file (see above)

### Docker Compose (Recommended)

> **Note:** Requires Docker Compose V2 (`docker compose`). If you have the old `docker-compose` v1, either upgrade or start Redis manually (see below).

```bash
git clone <repo-url>
cd report-daily-bot
cp .env.example .env   # fill in your values
docker compose up -d
```

This starts two containers:

- `report-daily-bot` — application (port from `PORT` env, default 3000)
- `report-daily-bot-redis` — Redis 7 (port from `REDIS_PORT` env, default 6379)

To use a different port, set `PORT` in `.env`:

```env
PORT=4000
```

### Local Development

If `docker compose up -d redis` fails (e.g. old docker-compose v1), start Redis manually:

```bash
# Option A: docker compose v2
docker compose up -d redis

# Option B: manual docker run (if docker-compose v1 breaks)
docker run -d --name report-daily-bot-redis -p 6379:6379 \
  redis:7-alpine redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy noeviction
```

Then start the app:

```bash
pnpm install
pnpm watch   # development mode with hot reload
```

Verify Redis is running:

```bash
docker exec report-daily-bot-redis redis-cli ping
# PONG
```

### Register Bot Commands

After the first launch, register commands in Telegram:

```bash
curl -X POST http://localhost:3000/report/setup-owner-commands
curl -X POST http://localhost:3000/report/setup-user-commands
```

### Verify Everything Works

```bash
# Check app is responding
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# 404 (no root route — expected, confirms the app is running)

# Check Redis
docker exec report-daily-bot-redis redis-cli ping
# PONG
```

### Available Scripts

| Script             | Description                      |
| ------------------ | -------------------------------- |
| `pnpm watch`       | Development mode with hot reload |
| `pnpm build`       | Build the project                |
| `pnpm start`       | Start the application            |
| `pnpm start:dev`   | Alias for `watch`                |
| `pnpm start:debug` | Start with debugger attached     |
| `pnpm start:prod`  | Start from compiled `dist/`      |
| `pnpm lint`        | Lint with auto-fix               |
| `pnpm format`      | Format with Prettier             |

## HTTP API

| Method | Endpoint                       | Description                         |
| ------ | ------------------------------ | ----------------------------------- |
| `POST` | `/telegram/webhook`            | Telegram Bot API webhook            |
| `POST` | `/report/setup-owner-commands` | Register admin commands in Telegram |
| `POST` | `/report/setup-user-commands`  | Register user commands in Telegram  |

## Data Model

### User

| Field                     | Type    | Description                           |
| ------------------------- | ------- | ------------------------------------- |
| `adminId`                 | string  | GitLab username (unique)              |
| `telegramId`              | number  | Telegram user ID                      |
| `gitLabId`                | number  | GitLab user ID                        |
| `portalId`                | number  | Bitrix24 Portal ID                    |
| `role`                    | enum    | Developer, QA, Project Manager, Admin |
| `status`                  | enum    | Active, Blocked, Vacation             |
| `gender`                  | enum    | Male, Female                          |
| `settings.useAI`          | boolean | Enable AI for reports                 |
| `settings.reportHour`     | number  | Auto-send hour (0–23)                 |
| `settings.reportTemplate` | enum    | Standard, QA                          |
| `settings.language`       | enum    | RU, EN                                |

## How It Works

1. **Admin** adds a user via `/add_user` with GitLab username, Telegram ID, role, and report hour
2. Bot automatically resolves `gitLabId` and `portalId` from the username
3. Every hour a cron job checks which users are due for a report
4. A BullMQ job is created for each user
5. The consumer generates the report (GitLab → mapping → AI) and sends it via Telegram
6. Users can request a report manually via `/send_report` at any time

## License

Private
