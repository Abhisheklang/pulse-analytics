<p align="center">
  <img src="src/assets/logo.svg" alt="Pulse Analytics Logo" width="100">
</p>

<h1 align="center">Pulse Analytics</h1>

<p align="center">
  <i>Know your traffic. Guard their privacy.</i>
</p>

<p align="center">
  Pulse Analytics is a self-hosted, privacy-first web analytics platform. Track pageviews,
  sessions, events, funnels, retention and more — with no cookies and no third-party trackers,
  on infrastructure you control.
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

## Screenshots

A look at the current interface — home, reporting, experiments and theming.

**Home** — the Pulse summary strip and a card for every site.

![Home — summary strip and site cards](docs/screenshots/home.png)

**Website overview** — insights and the annotated traffic chart for one site.

![Website overview — insights and traffic chart](docs/screenshots/website-overview.png)

**Roll-up** — combined totals, trend and per-site comparison across every site.

![Roll-up — all sites combined](docs/screenshots/rollup.png)

**Experiments** — A/B test results with exposures, conversion rates and a significance verdict.

![Experiments — A/B test results](docs/screenshots/experiments.png)

**Themes** — light, dark or system mode, five colour presets, and an animations toggle.

![Themes — colour presets in Preferences](docs/screenshots/themes.png)

**On a phone** — the same home page in the compact layout, navigation tucked into a drawer.

![Home on a phone — compact layout](docs/screenshots/home-phone.png)

## ✨ Features

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

**Added in this version** (full details under "What changed" below)

- Rule-based insights and chart annotations
- Traffic alerts and scheduled reports — delivered to webhooks, Slack, Discord, Telegram or email
- A/B testing (Experiments) with statistical-significance testing built in
- Drag-and-drop custom dashboards and a cross-site roll-up view
- Uptime monitoring with incidents and a public status page
- Core Web Vitals tracking (LCP, INP, CLS, FCP, TTFB)
- Data-warehouse export to S3 or BigQuery, plus a live event debugger
- CSV importer (GA4, Plausible, Matomo), an admin audit log and a built-in scheduler

### What changed in this version

- **Name** — the product is presented as "Pulse Analytics" across page titles, navigation,
  the login screen, share pages, the API documentation and all bundled UI translations.
- **Logo** — a new original mark: a plus sign merged with a pulse/heartbeat line, drawn in the
  brand palette (see [BRANDING.md](BRANDING.md)). Ships as the app logo and the full favicon set.
- **Colours** — the "Midnight Pulse" palette (indigo `#4f46e5` → violet `#7c3aed`) applied to
  the UI accent colour, chart colour scale and dashboard theme colours.
- **Tagline** — "Know your traffic. Guard their privacy." on the login screen, page metadata
  and this README.
- **No phone-home** — the upstream update check, build telemetry and telemetry pixel were
  removed/disabled. This build never contacts the original project's servers.
- **Own packages** — the two workspace packages were renamed to `@pulselytics/api-client`
  and `@pulselytics/mcp`, with Pulse-named exports (`PulseClient`, `createPulseMcpServer`),
  under the owner's own npm scope.
- **Vendored UI library** — the React component library is now a third own package,
  `@pulselytics/react-zen` under `packages/react-zen`. It is a vendored copy of the
  MIT-licensed react-zen library (v0.255.0, © Umami Software, Inc.), carried in-tree with
  its licence intact and built from source as part of the normal build; its public API,
  component names and `--zen-*` CSS variables are unchanged.
- **Renamed contracts** — the functional contracts carry Pulse names too (a clean
  break made pre-launch, with no compatibility shims): the tracker API is
  `window.pulse` / `pulseConfig` with `data-pulse-event*` attributes, all API
  headers are `x-pulse-*`, API keys use the `pulse_` prefix, environment variables
  are `PULSE_*`, and web-storage keys are `pulse.*`. The database schema and
  migration names are unchanged.

### Pulse extras added in this version

New operator/workflow features, implemented additively (new `pulse_*` tables, new
`/api/pulse/*` routes, a new "Pulse" section in the website sidebar). The new features are
built and verified against the PostgreSQL deployment of this build.

- **Chart annotations** — annotate the traffic chart (product launches, campaigns) with
  dated notes; markers render on the Overview chart (this capability ships in the base
  product and is verified working in this build).
- **Traffic alerts** — per-website rules (spike/drop/threshold/no-data over pageviews or
  visitors) delivered to any webhook, with a full evaluation history. Evaluate with
  `POST /api/pulse/cron/alerts` (localhost, or the `x-cron-secret` header when
  `CRON_SECRET` is set) — e.g. from system cron: `curl -X POST http://localhost:3000/api/pulse/cron/alerts`.
- **Scheduled summary reports** — daily/weekly digests (visitors, views, bounce, top
  pages/referrers/countries + CSV) sent to a webhook, with report history and a
  "Send now" action. Due schedules run via `POST /api/pulse/cron/reports`. Email
  recipients can be recorded; actual email sending is config-gated behind
  `PULSE_SMTP_URL` and is not live-tested in this build.
- **Data retention & privacy controls** — per-website retention days with a manual
  cleanup action (deletes old events/sessions and reports the counts), plus event
  export by date range as CSV/JSON.
- **CSV importer** — import GA4, Plausible or Matomo exports (plus a generic layout)
  as real pageviews/sessions that appear in all stats. Sample files live in `samples/`.
- **Public live badge** — an SVG "visitors today" badge per website, protected by a
  per-site token, with a preview and embed snippet in the UI.
- **Webhook event forwarding** — forward accepted tracking events to any webhook in
  real time (best-effort, never blocks collection), with a delivery log.
- **Data quality & broken pages** — a report of potential broken pages, their
  referrers, bounce-heavy pages and spam-referrer flags.
- **Rule-based insights** — plain-English insight cards computed deterministically
  from period-over-period data (traffic change, page gainers/losers, referrer
  drivers, device shifts, annotation correlations). No AI, no external calls.

### Pulse wave 2

- **Core Web Vitals** — an optional add-on script (`/pulse-vitals.js`, included
  alongside the standard tracking script) measures LCP, INP, CLS, FCP and TTFB in
  visitors' browsers and reports them as `pulse.webvital` events. The Web Vitals
  page shows per-page average + p75 per metric, colour-coded against the standard
  thresholds (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1), plus a site-wide summary.
- **Slack / Discord / Telegram delivery** — alert rules and report schedules can
  deliver to Slack (incoming webhook, Block Kit formatting), Discord (webhook,
  embed formatting) or Telegram (Bot API, HTML formatting) in addition to generic
  webhooks. Delivery logs record the channel and HTTP status. For Telegram the API
  base can be overridden with `PULSE_TELEGRAM_API_BASE` (used for testing).
- **Cross-site roll-up** — a combined view of every website on the account
  (linked as "Pulse roll-up" from the Websites page, at `/pulse/overview`):
  combined visitors/views/visits/bounce, a per-site comparison table and a
  combined daily trend.
- **Uptime monitoring** — per-website monitors with status history and incidents.
  Checks run via `POST /api/pulse/cron/uptime` (same trigger pattern as alerts —
  point system cron at it at your chosen interval). When a site goes down an
  incident opens and a notification is sent to the monitor's webhook.
- **GDPR toolkit** — on the Privacy & Retention page: look up everything stored
  for one visitor by session ID, export it as JSON, or erase it (with counts of
  what was deleted), plus a privacy audit panel listing what Pulse stores per
  visitor. Raw IP addresses are never stored and the tracker sets no cookies.
- **Revenue tracking** — any custom event whose data includes a numeric
  `revenue` value (and an optional `currency`) counts as revenue. The Revenue
  page shows totals, a daily trend, revenue by page and by referrer, and average
  revenue per visitor, with the tracking snippet documented on the page itself.

### Pulse wave 3

- **A/B testing** — per-website experiments with weighted variants and a chosen
  conversion event. The optional `/pulse-ab.js` add-on (included alongside the
  standard tracking script) assigns visitors deterministically, reports an
  `experiment.exposure` event per assignment, and exposes the variant to your
  page code. The results page shows exposures, conversions, conversion rate and
  uplift per variant, plus a pooled two-proportion z-test with a p-value and a
  "significant at 95%" verdict (with a clear not-enough-data state below 30
  exposed visitors per variant).
- **Custom dashboards** — account-level dashboards built from a widget catalog
  (visitor/view/bounce stats, views trend, top pages/referrers/countries,
  devices split, revenue total, realtime online count), each bound to a website
  and period. Widgets are arranged on a grid with drag-and-drop reordering and
  the layout is persisted per dashboard (linked as "Custom dashboards" from the
  Websites page, at `/pulse/dashboards`).
- **Data warehouse export** — per-website export jobs that ship raw events
  (with event data) as NDJSON or CSV to an S3-compatible bucket (AWS Signature
  V4 signing — works with AWS S3, MinIO, R2 and similar) or into BigQuery
  (service-account JWT → OAuth token exchange + streaming insert), with a run
  history recording rows exported, bytes and status. The BigQuery endpoints can
  be overridden with `PULSE_BIGQUERY_TOKEN_URL` / `PULSE_BIGQUERY_API_BASE`.
- **Live event debugger** — a per-website live feed of the newest events
  (pageviews and custom events) refreshing every few seconds, with an
  event-name/path filter, expandable raw event data, pause, and a "send test
  event" button for verifying collection end-to-end.
- **Public status page** — every website with the live badge enabled also gets
  a public status page at `/status/<websiteId>`, gated by the same per-site
  token, showing current status, 24h/30d uptime and the recent check history
  from uptime monitoring.
- **Admin audit log** — sensitive operator actions are recorded (visitor data
  deletion, retention cleanup runs, CSV imports, warehouse export runs and data
  exports) and listed for admins under Admin → Audit Log, newest first, with
  filters by action type.

---

## 🚀 Getting Started

### Requirements

- A server with Node.js version 20.19+ (22 LTS recommended).
- A PostgreSQL database version v12.14+.

### Install from source

```bash
git clone <this-repo-url>
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

The build step will create tables in your database if you are installing for the first time.
It will also create a login user with username **Admin** and password **Admin**.
You will be required to change this password after signing in.

### Start the application

```bash
pnpm run start
```

By default, this will launch the application on `http://localhost:3000`.

---

## 📦 Deployment

Pulse Analytics is deployed by building from source, as described above: install
dependencies with pnpm, set `DATABASE_URL` and `APP_SECRET` in `.env`, run
`pnpm run build`, then `pnpm run start`. Container images are not published for
this version, and container deployment files are not included in this repository.
Run it behind a reverse proxy (or a process manager such as systemd) for
production use.

---

## 🔄 Getting Updates

```bash
git pull
pnpm install
pnpm build
```

---

## 📄 License

MIT — see [LICENSE](LICENSE). The license and the original copyright notice of the Umami
project are retained unchanged, as the MIT License requires.
