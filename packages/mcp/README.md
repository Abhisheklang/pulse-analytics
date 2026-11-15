# @pulselytics/mcp

[Model Context Protocol](https://modelcontextprotocol.io) server for Pulse Analytics.
Lets Claude, ChatGPT, Cursor and other MCP clients answer questions about your
website traffic using read-only tools that call the Pulse Analytics API through `@pulselytics/api-client`.

The MCP server never talks to a database; every tool goes through the public API and the same
user/team permission checks as the web app.

## Tools

| Tool                  | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `list_websites`       | Find the websites you can access (call first to get a `websiteId`).     |
| `get_website_daterange` | Earliest and latest dates with recorded data.                         |
| `get_website_stats`   | Pageviews, visitors, visits, bounce rate, duration + previous period.   |
| `get_website_traffic` | Pageview/visit time series by minute, hour, day, month or year.         |
| `get_website_metrics` | Top pages, referrers, channels, countries, browsers, devices, UTM, events. |
| `get_realtime`        | Visitors active right now.                                              |
| `get_events`          | Individual tracked events (paginated).                                  |
| `get_event_stats`     | Custom event totals + previous period.                                  |
| `get_event_series`    | Custom event counts over time, grouped by event name.                   |
| `get_event_properties` | Custom event property names, or the values of one property.            |
| `get_sessions`        | Visitor sessions (paginated).                                           |
| `get_session_stats`   | Session-level totals: visitors, visits, pageviews, events, countries.   |
| `get_annotations`     | Dated notes on the timeline (launches, campaigns) to explain changes.  |
| `list_segments`       | Saved segments and cohorts; pass IDs via `filters.segment` / `.cohort`. |
| `get_session`         | One session with its activity timeline and properties.                  |
| `list_funnels`        | Saved funnels with their steps (get a `funnelId` for `run_funnel`).     |
| `run_funnel`          | Conversion funnel from a saved `funnelId` or ad-hoc page/event steps.    |
| `get_goals`           | Saved goals with conversions, visitors and rate for a range.           |
| `run_journey`         | Most common paths visitors take.                                        |
| `run_retention`       | Cohort retention table.                                                 |
| `run_attribution`     | First/last-click attribution for a conversion.                          |
| `get_revenue`         | Revenue totals, series and breakdowns.                                  |
| `get_performance`     | Core Web Vitals (LCP, INP, CLS, FCP, TTFB) percentiles, trend, breakdown. |

All tools are read-only. Dates are ISO 8601; results are paginated with a hard cap on page size.

## Remote: a hosted Pulse Analytics instance

If a Pulse Analytics instance you use is reachable over HTTPS (for example one your team
hosts for you), connect your MCP client directly to its Streamable HTTP endpoint using an
API key generated on that instance:

```text
https://pulse.example.com/mcp
Authorization: Bearer <your-api-key>
```

Use a client that supports bearer-token or custom authorization-header configuration. The
instance validates the key on every request, and all tools respect the key owner's existing
website/team permissions.

## Remote: self-hosted

Generate an API key under **Settings → API keys** in your Pulse Analytics instance, then configure your
MCP client with the Streamable HTTP endpoint:

```text
https://your-pulse.example.com/mcp
```

Set the authorization header using your key:

```text
Authorization: Bearer <your-api-key>
```

Use a client that supports bearer tokens or custom authorization headers. The endpoint accepts
self-hosted API keys; browser login tokens are not supported. Tools are read-only and respect
the key owner's existing user/team permissions. Revoke the key in Settings to disconnect access.
MCP is disabled by default. Set `MCP_ENABLED=1` to enable the endpoint.

## Local / stdio

```json
{
  "mcpServers": {
    "pulse": {
      "command": "npx",
      "args": ["-y", "@pulselytics/mcp"],
      "env": {
        "PULSE_URL": "https://analytics.example.com",
        "PULSE_API_TOKEN": "<your-api-key>"
      }
    }
  }
}
```

| Variable          | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `PULSE_URL`       | Self-hosted instance URL (`/api` is appended).                     |
| `PULSE_API_URL`   | Full API base URL instead, e.g. `https://pulse.example.com/api`.   |
| `PULSE_API_TOKEN` | API key or login token (self-hosted).                              |
| `PULSE_API_KEY`   | API key for your Pulse Analytics instance.                         |

With only an API key (no instance URL or token), requests go to the client's default base
URL (`http://localhost:3000`) unless `PULSE_API_URL` is also set:

```json
{
  "mcpServers": {
    "pulse": {
      "command": "npx",
      "args": ["-y", "@pulselytics/mcp"],
      "env": { "PULSE_API_KEY": "<your-api-key>" }
    }
  }
}
```

## Example prompts

- Show my websites.
- How many visitors did example.com get last week?
- What were the top 10 pages this month?
- Compare traffic this month with the previous month.
- Where is traffic coming from?
- What signup events occurred yesterday?
- Show sessions for user abc123.
- Which pricing plans did people select in the checkout event last month?
- How many signup events fired each day this week?
- Run my checkout funnel for last month.
- How are we doing against our goals this quarter?
- Which pages have the worst LCP on mobile?
- What happened on the day traffic spiked?

## Programmatic use

```ts
import { PulseClient } from '@pulselytics/api-client';
import { createPulseMcpServer } from '@pulselytics/mcp';

const server = createPulseMcpServer({
  client: new PulseClient({ baseUrl, token }),
});
```

`createPulseMcpHttpHandler({ createClient })` returns a Streamable HTTP handler for embedding in
any web framework; the host verifies the bearer token and passes `authInfo`.
