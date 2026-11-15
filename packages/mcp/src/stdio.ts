import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { PulseClient, type PulseClientOptions } from '@pulselytics/api-client';
import { type McpLogger, stderrLogger } from './lib/logger';
import { createPulseMcpServer } from './server';

export interface StdioEnvironment {
  PULSE_URL?: string;
  PULSE_API_URL?: string;
  PULSE_API_TOKEN?: string;
  PULSE_API_KEY?: string;
  [key: string]: string | undefined;
}

function trimSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

/**
 * Resolves client options from environment variables:
 *
 * - `PULSE_API_URL` — full API base URL (e.g. `https://pulse.example.com/api`).
 * - `PULSE_URL` — self-hosted instance URL; `/api` is appended automatically.
 * - `PULSE_API_TOKEN` — bearer token (login token or self-hosted API key).
 * - `PULSE_API_KEY` — API key for your Pulse Analytics instance.
 */
export function resolveClientOptions(env: StdioEnvironment = process.env): PulseClientOptions {
  const apiUrl = env.PULSE_API_URL?.trim();
  const instanceUrl = env.PULSE_URL?.trim();
  const token = env.PULSE_API_TOKEN?.trim();
  const apiKey = env.PULSE_API_KEY?.trim();

  if (!token && !apiKey) {
    throw new Error(
      'Missing credentials. Set PULSE_API_TOKEN (self-hosted API key or login token) or PULSE_API_KEY.',
    );
  }

  let baseUrl: string | undefined;

  if (apiUrl) {
    baseUrl = trimSlashes(apiUrl);
  } else if (instanceUrl) {
    const trimmed = trimSlashes(instanceUrl);
    baseUrl = /\/api$/.test(trimmed) ? trimmed : `${trimmed}/api`;
  }

  return { baseUrl, token, apiKey };
}

export interface ServeStdioOptions {
  env?: StdioEnvironment;
  logger?: McpLogger;
}

/** Serves the Pulse Analytics MCP server over stdio for local agents (Claude Desktop, Cursor, …). */
export function servePulseStdio(options: ServeStdioOptions = {}) {
  const client = new PulseClient(resolveClientOptions(options.env));
  const logger = options.logger ?? stderrLogger;

  return serveStdio(() => createPulseMcpServer({ client, logger }));
}
