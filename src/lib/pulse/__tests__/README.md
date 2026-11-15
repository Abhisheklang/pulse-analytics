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

Database- and network-bound behavior (the scheduler's lease, SMTP delivery,
API routes) is verified end-to-end against the running app instead of here.
