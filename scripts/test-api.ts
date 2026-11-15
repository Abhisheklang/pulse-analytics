/* eslint-disable no-console */
/**
 * Orchestrates a Playwright suite against an already-running Pulse server:
 *
 *   1. waits for /api/heartbeat on PLAYWRIGHT_BASE_URL
 *   2. runs Playwright against it: the API suite (tests/api,
 *      playwright.api.config.ts), or with --e2e the browser suite (tests/e2e,
 *      playwright.config.ts)
 *
 * The server under test must already be running (for example `pnpm build &&
 * pnpm start` locally, or a CI service). This script never starts, builds or
 * stops a server itself.
 *
 * Usage: tsx scripts/test-api.ts [options] [-- playwright args]
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDisposableTarget } from '../tests/api/paths';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// PLAYWRIGHT_BASE_URL selects the already-running server to test. There is no
// default: running the suites against the wrong server would be destructive,
// so the target must always be named explicitly.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || '';
const HEARTBEAT_TIMEOUT_MS = 180_000;

const HELP = `
Usage: pnpm test:api [options] [-- playwright args]

Options:
  --e2e               Run the browser suite (tests/e2e) instead of the API suite
  --clickhouse        The target server stores analytics in ClickHouse
                      (sets PULSE_TEST_DB=clickhouse for the suite)
  --grep <expr>       Only run matching tests (implies --coverage-report)
  --coverage-report   Print endpoint coverage without failing the run (API suite only)
  -h, --help          Show this help

Environment:
  PLAYWRIGHT_BASE_URL  Required. URL of the already-running server to test,
                      e.g. http://localhost:3000. The server is never started
                      or stopped by this script.
  API_ALLOW_DESTRUCTIVE=1  Required for non-loopback PLAYWRIGHT_BASE_URL targets: the suite
                      recreates websites, ingests data and toggles global 2FA
  API_SKIP_SEED=1     Reuse the previous seed when re-running against the same
                      server (each run seeds additively otherwise)
`;

interface Options {
  e2e: boolean;
  clickhouse: boolean;
  grep?: string;
  coverageReport: boolean;
  passthrough: string[];
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    e2e: false,
    clickhouse: false,
    coverageReport: false,
    passthrough: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') {
      options.passthrough.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--grep=')) {
      options.grep = arg.slice('--grep='.length);
      continue;
    }

    switch (arg) {
      case '--e2e':
        options.e2e = true;
        break;
      case '--clickhouse':
        options.clickhouse = true;
        break;
      case '--coverage-report':
        options.coverageReport = true;
        break;
      case '--grep':
        options.grep = argv[++i];
        break;
      case '-h':
      case '--help':
        console.log(HELP);
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        console.log(HELP);
        process.exit(2);
    }
  }

  return options;
}

function run(command: string, args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

async function waitForHeartbeat(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/heartbeat`);

      if (response.ok) {
        return;
      }

      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = (error as Error).message;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${url}/api/heartbeat (${lastError})`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const profile = options.clickhouse ? 'clickhouse' : 'postgres';

  if (!BASE_URL) {
    console.error(
      'PLAYWRIGHT_BASE_URL is not set. Start a Pulse server first (e.g. `pnpm build && pnpm start`),\n' +
        'then re-run with its URL:\n' +
        '  PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm test:api',
    );
    return 2;
  }

  try {
    assertDisposableTarget(BASE_URL);
  } catch (error) {
    console.error((error as Error).message);
    return 2;
  }

  console.log(`Using the already-running server at ${BASE_URL} (PLAYWRIGHT_BASE_URL is set).`);

  await waitForHeartbeat(BASE_URL, HEARTBEAT_TIMEOUT_MS);

  console.log(`Pulse is ready at ${BASE_URL}`);

  // Invoke the Playwright CLI through the current node binary instead of
  // `pnpm exec`: on Windows that resolves to pnpm.cmd, which Node refuses to
  // spawn without a shell (EINVAL, CVE-2024-27980 hardening).
  const playwrightCli = path.join(
    path.dirname(createRequire(import.meta.url).resolve('@playwright/test/package.json')),
    'cli.js',
  );
  const playwrightArgs = [
    playwrightCli,
    'test',
    '-c',
    options.e2e ? 'playwright.config.ts' : 'playwright.api.config.ts',
  ];

  if (options.grep) {
    playwrightArgs.push('--grep', options.grep);
  }

  playwrightArgs.push(...options.passthrough);

  // The external server is the server under test, so Playwright must not start `pnpm dev`.
  const target = { PLAYWRIGHT_BASE_URL: BASE_URL, PLAYWRIGHT_SKIP_WEB_SERVER: '1' };

  const exitCode = run(
    process.execPath,
    playwrightArgs,
    options.e2e
      ? target
      : {
          ...target,
          PULSE_TEST_DB: profile,
          API_COVERAGE:
            process.env.API_COVERAGE ??
            (options.grep || options.coverageReport ? 'report' : 'enforce'),
        },
  );

  if (exitCode !== 0 && options.e2e) {
    console.log(
      'Failure screenshots and traces are in test-results/.' +
        '\nOpen the report with: pnpm exec playwright show-report',
    );
  }

  return exitCode;
}

main()
  .then(code => {
    process.exit(code);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
