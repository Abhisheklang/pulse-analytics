import { z } from 'zod';
import { ASK_CAPABILITIES, ASK_EXAMPLES, askPulse, isLLMConfigured } from '@/lib/pulse/assistant';
import { checkRateLimit, rateLimitKey, tooManyRequests } from '@/lib/rate-limit';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canViewWebsite } from '@/permissions';

const askSchema = z.object({
  question: z.string().min(3).max(300),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  const llmConfigured = isLLMConfigured();
  return json({
    llmConfigured,
    mode: llmConfigured ? 'llm' : 'builtin',
    examples: ASK_EXAMPLES,
    capabilities: ASK_CAPABILITIES,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, askSchema);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  // SEC-3: Ask Pulse can trigger paid LLM calls and unbounded stats
  // queries, and is reachable with a share token, so throttle per
  // caller and website.
  const limit = checkRateLimit(
    rateLimitKey(request, 'ask', `${websiteId}:${auth?.user?.id || 'share'}`),
    20,
    10 * 60 * 1000,
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const result = await askPulse(websiteId, body.question);
  return json(result);
}
