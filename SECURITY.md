# Security policy

## Supported versions

Security fixes go into the latest release only. Until `1.0.0`, that is the latest pre-release.

## Reporting a vulnerability

Report a vulnerability privately through [GitHub](https://github.com/daetojecactus/report-daily/security/advisories/new), not in a public issue. Describe what an attacker can do, how to reproduce it and the affected release. The report stays private until a release with the fix is out.

## What matters most

The bot holds a GitLab token, bot tokens and an AI key, and shows work reports according to access levels. Especially important:

- access to another employee's reports, or to actions above one's access level;
- tokens or report texts in logs, chats or requests to the AI service;
- GitLab data that changes what the bot does or what the AI is told to do.
