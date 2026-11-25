<p align="center">
  <img src="src/assets/logo.svg" alt="Pulse Analytics Logo" width="100">
</p>

<h1 align="center">Pulse Analytics</h1>

<p align="center">
  <i>Know your traffic. Guard their privacy.</i>
</p>

<p align="center">
  Pulse Analytics is a self-hosted, privacy-first web analytics platform — an alternative to
  Google Analytics that you run on your own infrastructure. Track pageviews, sessions, events,
  funnels, retention and more, with no cookies and no third-party trackers.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://www.npmjs.com/package/@pulselytics/api-client"><img src="https://img.shields.io/npm/v/@pulselytics/api-client" alt="@pulselytics/api-client on npm"></a>
  <a href="https://www.npmjs.com/package/@pulselytics/mcp"><img src="https://img.shields.io/npm/v/@pulselytics/mcp" alt="@pulselytics/mcp on npm"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node.js 20 or newer">
</p>

---

## Attribution

> **Pulse Analytics is a modified version of [Umami](https://github.com/umami-software/umami),
> © Umami Software, Inc., used under the MIT License.** The underlying product was created by
> the Umami project; this version changes the branding, colours, logo and presentation only.
> See [LICENSE](LICENSE) for the original license and copyright notice, which are retained
> unchanged.

## What I built

Pulse Analytics is a modified, rebranded build of an existing open-source analytics
project, used under the MIT License (see Attribution above). The base platform provides
the core tracking, storage and reporting engine. Everything listed in this section is my
own work, added on top of that base:

- **The rebrand itself** - a new name, logo, palette and UI copy throughout, plus two
  published npm packages: `@pulselytics/api-client` and `@pulselytics/mcp`.
- **Ask Pulse** - plain-English questions answered from the site's own analytics data.
  A deterministic built-in parser converts each question into an allow-listed query plan
  (no free-form SQL), with an optional LLM mode that produces the same plan format.
- **Operator tools** - traffic alerts delivered to webhooks, Slack, Telegram, Discord or
  email; scheduled reports; a CSV importer for GA4, Plausible and Matomo exports;
  webhooks; and a built-in scheduler.
- **Analysis additions** - chart annotations, rule-based insights, Core Web Vitals
  tracking, revenue tracking, a cross-site roll-up dashboard, drag-and-drop custom
  dashboards, and A/B testing (Experiments) with significance testing.
- **Privacy and admin** - a GDPR toolkit (per-visitor lookup, export and erasure, plus
  retention controls with automatic cleanup), a live "visitors today" badge, an admin
  audit log, and an onboarding wizard.
- **Monitoring and data out** - uptime checks with a public status page, data-warehouse
  export to S3 or BigQuery, and a live event debugger.
- **The Pulse redesign** - light, dark and system modes, five colour presets, and a
  responsive layout with a phone navigation drawer.
- **Docker install** - a Dockerfile and Compose stack for the app and PostgreSQL, with a
  CI workflow that builds the image, runs the full stack as a test, and publishes it to
  the GitHub Container Registry.

## Screenshots

The current interface — home, reporting, the AI assistant, experiments and theming.

**Home** — the Pulse summary strip and a card for every site.

![Home — summary strip and site cards](docs/screenshots/home.png)

**Website overview** — insights and the annotated traffic chart for one site.

![Website overview — insights and traffic chart](docs/screenshots/website-overview.png)

**Ask Pulse** — the AI analytics assistant answering a question from real data, with the query plan shown.

![Ask Pulse — AI analytics assistant](docs/screenshots/ask-pulse.png)

**Ask Pulse on a phone** — the same assistant in the compact layout.

![Ask Pulse on a phone — compact layout](docs/screenshots/ask-pulse-phone.png)

**Roll-up** — combined totals, trend and per-site comparison across every site.

![Roll-up — all sites combined](docs/screenshots/rollup.png)

**Experiments** — A/B test results with exposures, conversion rates and a significance verdict.

![Experiments — A/B test results](docs/screenshots/experiments.png)

**Themes** — light, dark or system mode, five colour presets, and an animations toggle.

![Themes — colour presets in Preferences](docs/screenshots/themes.png)

**On a phone** — the same home page in the compact layout, navigation tucked into a drawer.

![Home on a phone — compact layout](docs/screenshots/home-phone.png)

## Features

**Core analytics**

- Pageviews, sessions, events and custom event data — in real time
- Funnels, retention, user journeys, campaigns and UTM tracking
- Revenue tracking, goals, and breakdowns by page, referrer, country, device and browser
- Public share links and a live "visitors today" badge for any site

**Privacy by design**

- No cookies and no personal-data collection; visitors are recognised by a daily-rotating salted hash
- GDPR toolkit — look up, export or erase everything stored for a single visitor
- Per-site data-retention controls with automatic cleanup
- Fully self-hosted — your data never leaves your infrastructure, and the app never phones home

**Added in this version** (details in the sections below)

- Rule-based insights and chart annotations
- Ask Pulse — an AI analytics assistant: ask plain-English questions, get answers computed from your own data, with the query plan shown
- Traffic alerts and scheduled reports — delivered to webhooks, Slack, Discord, Telegram or email
- A/B testing (Experiments) with statistical-significance testing built in
- Drag-and-drop custom dashboards and a cross-site roll-up view
- Uptime monitoring with incidents and a public status page
- Core Web Vitals tracking (LCP, INP, CLS, FCP, TTFB)
- Data-warehouse export to S3 or BigQuery, plus a live event debugger
- CSV importer (GA4, Plausible, Matomo), an admin audit log and a built-in scheduler

### About this build

- **Self-hosted only** — Pulse Analytics never phones home: no update checks, no telemetry, no external calls except the delivery endpoints you configure yourself (webhooks, Slack, Discord, Telegram, email, S3/BigQuery).
- **Packages** — the API client and the MCP server are published on npm as `@pulselytics/api-client` and `@pulselytics/mcp` (`PulseClient`, `createPulseMcpServer`). The UI component library ships in-tree as `@pulselytics/react-zen` under `packages/react-zen` and is built from source as part of the normal build.
- **Tracker & API** — the tracking snippet is `window.pulse` / `pulseConfig` with `data-pulse-event*` attributes; API headers are `x-pulse-*`, API keys use the `pulse_` prefix, settings are `PULSE_*` environment variables, and browser storage keys are `pulse.*`.
- **Design** — the "Midnight Pulse" palette (indigo `#4f46e5` → violet `#7c3aed`), an original logo (see [BRANDING.md](BRANDING.md)), and five switchable colour themes with light, dark and system modes.

## Ask Pulse: an AI analytics assistant

Ask Pulse answers plain-English questions about a website's analytics, on the **Ask Pulse** page in the website sidebar. Examples:

- "Which pages got the most views this month?"
- "How many visitors came from Google this week?"
- "Why did traffic drop last Tuesday?"
- "What are my top referrers in the last 30 days?"
- "Show me pageviews per day this week"
- "What is my bounce rate this month?"

![Ask Pulse — a question answered from real data, with the query plan shown](docs/screenshots/ask-pulse.png)

How it works — safety first:

- A question is never turned into free-form SQL. It is converted into a structured **query plan** (intent, metric, breakdown, date range) drawn from a fixed allow-list, and only that plan runs — through the same parameterized data layer as every other report. The plan that ran is shown under each answer, so you can see exactly what was measured.
- Every number in the explanation comes from the executed result. If a question cannot be mapped to a supported plan, Ask Pulse says so and lists what it can answer, instead of inventing an answer. It is read-only and cannot identify individual visitors.

Two modes:

- **Built-in parser (default)** — a deterministic parser built into Pulse covers the supported question types: totals (pageviews, visitors, visits, bounce rate), top pages/referrers/countries/browsers/systems/devices, per-day trends, period-over-period change with the biggest page and referrer movers, and counts for a single referrer — over today, yesterday, a named weekday, the last N days, or this/last week or month. No external calls are made.
- **LLM mode** — set the `OPENAI_API_KEY` environment variable on the server (optionally `OPENAI_MODEL`, default `gpt-4o-mini`) and questions are first parsed by the model into the same allow-listed plan format. Model output is validated against the allow-list before anything runs; invalid output falls back to the built-in parser. The current mode is shown as a badge on the Ask Pulse page.

## Operator tools: alerts, reports, imports

New operator and workflow features, implemented additively (new `pulse_*` tables, new `/api/pulse/*` routes, a new "Pulse" section in the website sidebar), built and verified against the PostgreSQL deployment of this build.

- **Chart annotations** — annotate the traffic chart (product launches, campaigns) with dated notes; markers render on the Overview chart.
- **Traffic alerts** — per-website rules (spike/drop/threshold/no-data over pageviews or visitors) delivered to any webhook, with a full evaluation history. Evaluate with `POST /api/pulse/cron/alerts` (localhost, or the `x-cron-secret` header when `CRON_SECRET` is set) — e.g. from system cron: `curl -X POST http://localhost:3000/api/pulse/cron/alerts`.
- **Scheduled summary reports** — daily/weekly digests (visitors, views, bounce, top pages/referrers/countries + CSV) sent to a webhook, with report history and a "Send now" action. Due schedules run via `POST /api/pulse/cron/reports`. Email recipients can be recorded; email sending is config-gated behind `PULSE_SMTP_URL`.
- **Data retention & privacy controls** — per-website retention days with a manual cleanup action (deletes old events/sessions and reports the counts), plus event export by date range as CSV/JSON.
- **CSV importer** — import GA4, Plausible or Matomo exports (plus a generic layout) as real pageviews/sessions that appear in all stats. Sample files live in `samples/`.
- **Public live badge** — an SVG "visitors today" badge per website, protected by a per-site token, with a preview and embed snippet in the UI.
- **Webhook event forwarding** — forward accepted tracking events to any webhook in real time (best-effort, never blocks collection), with a delivery log.
- **Data quality & broken pages** — a report of potential broken pages, their referrers, bounce-heavy pages and spam-referrer flags.
- **Rule-based insights** — plain-English insight cards computed deterministically from period-over-period data (traffic change, page gainers/losers, referrer drivers, device shifts, annotation correlations). No AI, no external calls.

## Delivery, roll-up and privacy

- **Core Web Vitals** — an optional add-on script (`/pulse-vitals.js`, included alongside the standard tracking script) measures LCP, INP, CLS, FCP and TTFB in visitors' browsers and reports them as `pulse.webvital` events. The Web Vitals page shows per-page average + p75 per metric, colour-coded against the standard thresholds (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1), plus a site-wide summary.
- **Slack / Discord / Telegram delivery** — alert rules and report schedules can deliver to Slack (incoming webhook, Block Kit formatting), Discord (webhook, embed formatting) or Telegram (Bot API, HTML formatting) in addition to generic webhooks. Delivery logs record the channel and HTTP status. For Telegram the API base can be overridden with `PULSE_TELEGRAM_API_BASE` (used for testing).
- **Cross-site roll-up** — a combined view of every website on the account (linked as "Pulse roll-up" from the Websites page, at `/pulse/overview`): combined visitors/views/visits/bounce, a per-site comparison table and a combined daily trend.
- **Uptime monitoring** — per-website monitors with status history and incidents. Checks run via `POST /api/pulse/cron/uptime` (same trigger pattern as alerts — point system cron at it at your chosen interval). When a site goes down an incident opens and a notification is sent to the monitor's webhook.
- **GDPR toolkit** — on the Privacy & Retention page: look up everything stored for one visitor by session ID, export it as JSON, or erase it (with counts of what was deleted), plus a privacy audit panel listing what Pulse stores per visitor. Raw IP addresses are never stored and the tracker sets no cookies.
- **Revenue tracking** — any custom event whose data includes a numeric `revenue` value (and an optional `currency`) counts as revenue. The Revenue page shows totals, a daily trend, revenue by page and by referrer, and average revenue per visitor, with the tracking snippet documented on the page itself.

## Experiments, dashboards and data export

- **A/B testing** — per-website experiments with weighted variants and a chosen conversion event. The optional `/pulse-ab.js` add-on (included alongside the standard tracking script) assigns visitors deterministically, reports an `experiment.exposure` event per assignment, and exposes the variant to your page code. The results page shows exposures, conversions, conversion rate and uplift per variant, plus a pooled two-proportion z-test with a p-value and a "significant at 95%" verdict (with a clear not-enough-data state below 30 exposed visitors per variant).
- **Custom dashboards** — account-level dashboards built from a widget catalog (visitor/view/bounce stats, views trend, top pages/referrers/countries, devices split, revenue total, realtime online count), each bound to a website and period. Widgets are arranged on a grid with drag-and-drop reordering and the layout is persisted per dashboard (linked as "Custom dashboards" from the Websites page, at `/pulse/dashboards`).
- **Data warehouse export** — per-website export jobs that ship raw events (with event data) as NDJSON or CSV to an S3-compatible bucket (AWS Signature V4 signing — works with AWS S3, MinIO, R2 and similar) or into BigQuery (service-account JWT → OAuth token exchange + streaming insert), with a run history recording rows exported, bytes and status. The BigQuery endpoints can be overridden with `PULSE_BIGQUERY_TOKEN_URL` / `PULSE_BIGQUERY_API_BASE`.
- **Live event debugger** — a per-website live feed of the newest events (pageviews and custom events) refreshing every few seconds, with an event-name/path filter, expandable raw event data, pause, and a "send test event" button for verifying collection end-to-end.
- **Public status page** — every website with the live badge enabled also gets a public status page at `/status/<websiteId>`, gated by the same per-site token, showing current status, 24h/30d uptime and the recent check history from uptime monitoring.
- **Admin audit log** — sensitive operator actions are recorded (visitor data deletion, retention cleanup runs, CSV imports, warehouse export runs and data exports) and listed for admins under Admin → Audit Log, newest first, with filters by action type.

---

## Getting started: install Pulse Analytics

### Requirements

- A server with Node.js version 20.19+ (22 LTS recommended).
- A PostgreSQL database version v12.14+.

For the Docker install below, you only need Docker with the Compose plugin. Node.js and PostgreSQL run inside the containers.

### Install with Docker

**Option 1: Docker Compose, app and database together**

```bash
git clone https://github.com/Abhisheklang/pulse-analytics.git
cd pulse-analytics
cp .env.docker.example .env
```

Edit `.env` and set a real `POSTGRES_PASSWORD` and `APP_SECRET` (generate one with `openssl rand -hex 32`). The password inside `DATABASE_URL` must match `POSTGRES_PASSWORD`.

```bash
docker compose up -d
```

This builds the application image, starts PostgreSQL 16, creates the database tables on first start, and serves Pulse Analytics on `http://localhost:3000`. Sign in with username **Admin** and password **Admin**, and change the password when asked. Database files are kept in a named Docker volume, so they survive container restarts and image updates.

**Option 2: Pull the published image**

Every push to the `main` branch publishes an image to the GitHub Container Registry:

```bash
docker pull ghcr.io/abhisheklang/pulse-analytics:latest
```

The image needs a PostgreSQL database (v12.14 or later) to connect to. For a quick local run with a companion database container:

```bash
docker network create pulse
docker run -d --name pulse-db --network pulse \
  -e POSTGRES_USER=pulse -e POSTGRES_PASSWORD=changeme -e POSTGRES_DB=pulse \
  -v pulse-db:/var/lib/postgresql/data \
  postgres:16
docker run -d --name pulse --network pulse -p 3000:3000 \
  -e DATABASE_URL=postgresql://pulse:changeme@pulse-db:5432/pulse \
  -e APP_SECRET=replace-with-a-random-string \
  ghcr.io/abhisheklang/pulse-analytics:latest
```

On start, the container checks the database connection and applies any pending database migrations before serving. To update, pull the new image and recreate the container; your data stays in the database.

### Install from source

```bash
git clone https://github.com/Abhisheklang/pulse-analytics.git
cd pulse-analytics
pnpm install
```

Create an `.env` file with the following:

```bash
DATABASE_URL=connection-url
APP_SECRET=random-string  # generate with: openssl rand -hex 32
```

The connection URL format:

```bash
postgresql://username:mypassword@localhost:5432/mydb
```

### Build the application

```bash
pnpm run build
```

The build step will create tables in your database if you are installing for the first time. It will also create a login user with username **Admin** and password **Admin**. You will be required to change this password after signing in.

### Start the application

```bash
pnpm run start
```

By default, this will launch the application on `http://localhost:3000`.

## Deployment

Pulse Analytics can be deployed in two ways. From source: install dependencies with pnpm, set `DATABASE_URL` and `APP_SECRET` in `.env`, run `pnpm run build`, then `pnpm run start`. With Docker: use the Compose file included in this repository, or the published image at `ghcr.io/abhisheklang/pulse-analytics`, as described in Install with Docker above. Either way, run it behind a reverse proxy (or, for source installs, a process manager such as systemd) for production use.

## Getting updates

```bash
git pull
pnpm install
pnpm build
```

## FAQ

**Is Pulse Analytics free?**
Yes — it is MIT-licensed open source. You run it on your own server with your own PostgreSQL database; there is no hosted tier, no account with us, and nothing to phone home to.

**Does Pulse Analytics use cookies?**
No. The tracker sets no cookies and collects no personal data. Visitors are recognised by a salted hash that rotates daily, raw IP addresses are never stored, and the GDPR toolkit can look up, export or erase everything stored for a single visitor.

**How is Pulse different from Google Analytics?**
Ownership and privacy. Your analytics live in your database on your infrastructure, not on an ad platform; there are no cookies to banner about, no third-party trackers, and no sampling. And when you outgrow the standard reports, Pulse adds alerts, experiments, uptime monitoring, warehouse export and an AI assistant that answers from your own data.

**Can I migrate from GA4, Plausible or Matomo?**
Yes — the CSV importer brings GA4, Plausible and Matomo exports (plus a generic layout) in as real pageviews and sessions that appear across all stats. Sample files are in `samples/`.

**What do I need to run it?**
Node.js 20.19+ (22 LTS recommended), PostgreSQL 12.14+, and pnpm. It builds and runs from source — no container images are published for this version.

**What is Ask Pulse, and does it send my data to an AI company?**
Ask Pulse answers plain-English questions from your analytics. By default it uses a built-in deterministic parser and makes no external calls at all. If you set `OPENAI_API_KEY`, questions are first parsed by that model into the same allow-listed query plans — the model never writes SQL, and every answer is computed from your database by Pulse itself.

## License

MIT — see [LICENSE](LICENSE). The license and the original copyright notice of the Umami project are retained unchanged, as the MIT License requires.
