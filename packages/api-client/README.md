# @pulselytics/api-client

Typed TypeScript client for the Pulse Analytics API. Every method is generated from
the project's OpenAPI contract (`public/openapi.json` in the main repository), so the client can never
drift from the server.

```bash
pnpm add @pulselytics/api-client
```

## Usage

```ts
import { PulseClient } from '@pulselytics/api-client';

// Local instance (the default base URL is http://localhost:3000)
const pulse = new PulseClient({ apiKey: process.env.PULSE_API_KEY });

// Remote self-hosted instance
const pulse = new PulseClient({
  baseUrl: 'https://analytics.example.com/api',
  token: process.env.PULSE_API_TOKEN, // API key or login token
});

const websites = await pulse.listWebsites();

const stats = await pulse.getWebsiteStats({
  websiteId,
  startAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  endAt: Date.now(),
});

const pages = await pulse.getWebsiteMetrics({ websiteId, startAt, endAt, type: 'path', limit: 10 });
```

Every method takes **one object** that merges path parameters, query parameters and the request
body. Method names are the OpenAPI `operationId`s; hover in your editor for the parameter and
response types, or import `OperationInput<'getWebsiteStats'>` / `OperationOutput<'…'>`.

### Options

| Option    | Description                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `baseUrl` | API root. Defaults to `http://localhost:3000`. Self-hosted: `https://your-instance/api`.                    |
| `token`   | Bearer token: login token or self-hosted API key.                                      |
| `apiKey`  | API key (sent as `x-pulse-api-key`; also sent as a bearer token when `token` is not provided). |
| `headers` | Extra headers for every request.                                                                            |
| `fetch`   | Custom `fetch` (tests, other runtimes, in-process dispatch).                                                |
| `timeout` | Per-request timeout in milliseconds.                                                                        |

### Errors

Non-2xx responses throw `PulseApiError` with `status`, `code` (`unauthorized`, `forbidden`,
`not-found`, `bad-request`, …), `message` and the parsed `body`.

```ts
import { isPulseApiError } from '@pulselytics/api-client';

try {
  await pulse.getWebsite({ websiteId });
} catch (error) {
  if (isPulseApiError(error) && error.isNotFound) {
    // …
  }
}
```

### Escape hatch

`pulse.call('operationId', input)` invokes any operation by ID; `operations` exports the full
table of methods, paths and parameters.

## Regenerating

From the Pulse Analytics repository root:

```bash
pnpm generate:api      # public/openapi.json → packages/api-client/src/generated
pnpm check:api:client  # CI: fail if generated files are stale
```

See [MIGRATION.md](./MIGRATION.md) if you are upgrading from the previous hand-written client.
