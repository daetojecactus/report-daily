# Contributing

Issues and pull requests are welcome. For a larger change, open an issue first to agree on the approach.

## Setup

Node.js 26, pnpm 12 and Docker. Use a test GitLab token and a separate test bot or Slack workspace: see [Development](README.md#development).

Before a pull request, run the checks; the integration tests start PostgreSQL and Redis in Docker:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:int
```

## Code

- Code, logs, tests and commits are in English. The code has no comments; ESLint checks it.
- Files are named `<module>.<role>.ts`, such as `report.service.ts`; imports start from `src/`. Constants and messages live in `constants/`, types in `types/`, tests in `__test__/` next to the code.
- A service holds the CRUD and business methods of its module; data access goes through its repository.
- Texts for users live only in the `ru` and `en` locales.
- The bot logic does not know the channel: a handler returns a screen, and Telegram and Slack draw it. Each handler declares its access level.
- A schema change comes with a migration from `pnpm db:generate --name <name>`; read the generated SQL.

## Pull requests

- One pull request per issue, from a branch named `<issue>-<slug>`.
- The title is a [Conventional Commit](https://www.conventionalcommits.org/) with a scope, such as `feat(report): sum up repeated work`. The scope is a module (`bot`, `user`, `trait`, `source`, `report`, `ai`, `template`, `schedule`, `delivery`, `broadcast`, `settings`, `telegram`, `slack`, `gitlab`, `llm`, `queue`, `db`, `config`) or `docker`, `ci`, `deps`, `release`.
- Pull requests are squash-merged: the title becomes the commit in `main` and the line in the changelog.
- The description follows the template: what changed, how it was checked, and the checklist.

Releases are made by the maintainer with [Release Please](https://github.com/googleapis/release-please).
