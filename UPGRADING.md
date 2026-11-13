# Upgrading

What changed in each release is in [CHANGELOG.md](CHANGELOG.md). This file lists only what the operator has to do; a release that is not listed here needs only the usual update.

## Updating

1. Back up PostgreSQL, see [Backups](README.md#backups): migrations only go forward.
2. Read the sections below for the releases after yours.
3. Set `REPORT_DAILY_VERSION` in `.env` to the new release.
4. Run `docker compose pull` and `docker compose up -d`. Compose applies the migrations before the bot starts.

To go back to an older release after an update with a migration, restore the backup and set the older release.

## 1.0.0-beta.1

The first release. The versions in the `v1` branch kept their data in MongoDB and have no upgrade path: install this release fresh.
