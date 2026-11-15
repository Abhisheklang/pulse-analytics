import {
  type AuthInfo,
  createMcpHandler,
  type McpHttpHandler,
  type McpRequestContext,
} from '@modelcontextprotocol/server';
import type { PulseClient } from '@pulselytics/api-client';
import type { McpLogger } from './lib/logger';
import type { AnyToolDefinition } from './lib/tool';
import { createPulseMcpServer } from './server';

export interface CreatePulseMcpHttpHandlerOptions {
  /**
   * Builds the API client for one request. Receives the verified `AuthInfo` (bearer token,
   * client ID, scopes) so the token can be propagated to the Pulse Analytics API unchanged.
   */
  createClient: (authInfo: AuthInfo, ctx: McpRequestContext) => PulseClient | Promise<PulseClient>;
  logger?: McpLogger;
  tools?: AnyToolDefinition[];
  onerror?: (error: Error) => void;
}

/**
 * Streamable HTTP handler (web-standard Request/Response) for the 2026-07-28 stateless protocol.
 * The host is responsible for verifying the bearer token and passing `authInfo` to `handler.fetch`.
 */
export function createPulseMcpHttpHandler(
  options: CreatePulseMcpHttpHandlerOptions,
): McpHttpHandler {
  return createMcpHandler(
    async ctx => {
      const authInfo = ctx.authInfo;

      if (!authInfo) {
        throw new Error(
          'MCP request is missing authInfo. Verify the bearer token before dispatch.',
        );
      }

      const client = await options.createClient(authInfo, ctx);
      const extra = (authInfo.extra ?? {}) as { userId?: string; requestId?: string };

      return createPulseMcpServer({
        client,
        logger: options.logger,
        tools: options.tools,
        identity: {
          userId: extra.userId,
          clientId: authInfo.clientId,
          requestId: extra.requestId,
        },
      });
    },
    { onerror: options.onerror, legacy: 'stateless' },
  );
}
