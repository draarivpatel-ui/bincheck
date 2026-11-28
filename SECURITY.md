# Security policy

## Reporting a vulnerability

Use the private GitHub Security Advisory form at [Report a vulnerability](https://github.com/draarivpatel-ui/bincheck/security/advisories/new). Do not open a public issue, pull request or discussion with exploit details.

Never include a live secret, token, cookie, private key, victim hostname or proprietary payload in a report. Use synthetic values and redacted transcripts.

## Supported versions

| Version | Status |
| --- | --- |
| latest `main` | Supported |

Security fixes are applied to the latest state of the default branch.

## Scope

This policy covers the static BinCheck browser application and rules engine, including search and item inspection, batch CSV parsing, municipal rules data, the service worker, share links, audit exports, barcode checks and browser rendering.

In scope:

- A cross-site scripting or HTML injection path through item data, batch CSV input, municipal rules data, share links, imported text or report output.
- A service worker or cache-control flaw that serves attacker-controlled application code across an update.
- A CSV parser, barcode decoder, share-link decoder or serialization flaw that bypasses validation, corrupts another inspection state, or executes attacker-controlled code.
- A report, audit or spreadsheet export flaw that makes generated output execute a formula or script when opened.
- An audit integrity verification bypass that makes altered output validate as untampered.
- A local-only boundary flaw that sends inspection content off the device without a clear user action.

Out of scope:

- Browser vulnerabilities, operating system compromise or physical access to the machine.
- Damage caused by modified copies of the static application that do not come from this repository.
- Municipal recycling policy accuracy or real-world facility acceptance, unless a report shows a specific validation or output integrity failure.

## Coordinated disclosure

- Acknowledgment: within 3 business days.
- Initial triage: within 14 calendar days.
- Fix or mitigation target: within 90 calendar days for confirmed reports.
- Coordinated public disclosure: up to 90 days by default, adjusted by mutual agreement when exploitation or user risk requires a different date.
