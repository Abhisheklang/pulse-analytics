# Pulse unit tests

Run them with:

```sh
pnpm test:pulse
```

This uses the repository's existing Vitest setup (`vitest.config.ts`,
`src/**/*.test.{ts,tsx}`) — no new dependencies were added for these tests.
The script exports a placeholder `DATABASE_URL` when none is set: importing
the app's Prisma module requires the variable to exist, but these suites
never open a database connection (an already-set `DATABASE_URL` is kept).

## What is covered

The suites exercise the *pure* logic of the Pulse feature modules, so they
run without a database or a running server:

| Suite | Module | Covers |
| --- | --- | --- |
| `experiments.test.ts` | `../experiments.ts` | Two-proportion z-test against the seeded demo statistics (10/100 vs 22/100 → z ≈ 2.3146, p ≈ 0.0206), sign flip, null guards |
| `badge.test.ts` | `../badge.ts` | Badge SVG width grows ~7px per character of label/value |
| `importer.test.ts` | `../importer.ts` | CSV parsing plus GA4/Plausible preset field mapping (dates, counts, sessions, referrer cleanup) on fixtures in the real export formats |
| `revenue.test.ts` | `../revenue.ts` | Revenue aggregation: the 185.74 USD demo fixture, by-day/by-page breakdowns, per-event currency overrides |
| `insights.test.ts` | `../insights.ts` | Referrer-driver selection, including the `'(direct)'` exclusion |
| `retention.test.ts` | `../retention.ts` | Retention cutoff date math and the disabled case |
| `exporter.test.ts` | `../exporter.ts` | AWS Signature V4 signing-key derivation against the AWS-documented example vector |
| `scheduler.test.ts` | `../scheduler.ts` | The scheduler's due-job decision function |

To make this possible without changing behavior, a few functions were
extracted from DB-bound modules into pure exported helpers
(`aggregateRevenueRows`, `mapImportRow`, `pickTopDriver`,
`deriveSigV4SigningKey`, `badgeSvg`, `retentionCutoff`, `isJobDue`); the
production code paths call the same helpers the tests assert on.

## API route tests

Four suites exercise the real Next.js route handlers for the custom Pulse
features, with the request/auth layer, the permission checks and the Prisma
client behind `pulseDb()` mocked (the pattern used by the repository's other
route tests, for example `src/app/api/auth/login/route.test.ts`). No live
database, no network, no LLM key: the Ask Pulse suite removes
`OPENAI_API_KEY` so the assistant runs on its deterministic built-in parser,
and its answers are computed from the mocked data layer for real.

| Suite | Routes | Covers |
| --- | --- | --- |
| `api-ask.test.ts` | `ask` | Built-in mode reporting, a pageviews answer computed from mocked events, an honest refusal, view-permission rejection, request validation passthrough |
| `api-alerts.test.ts` | `alerts` | Rule and log listing, webhook rule creation, Telegram and webhook-channel validation rejections, enable/disable toggle, missing rule |
| `api-experiments.test.ts` | `experiments` | Listing, creation with variant normalisation (first variant forced to control) and real results computation over empty event tables, duplicate experiment key, duplicate variant keys |
| `api-privacy.test.ts` | `privacy`, `privacy/visitor` | GDPR toolkit: setting with data range and counts, default setting creation, retention update, visitor lookup with flattened event data, full visitor erasure across tables with an audit entry, not-found and permission rejections |

Database- and network-bound behavior beyond these routes (the scheduler's
lease, SMTP and webhook delivery, the remaining routes) is verified
end-to-end against the running app instead of here.
