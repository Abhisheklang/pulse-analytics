import { z } from 'zod';
import { ASK_CAPABILITIES, ASK_EXAMPLES, askPulse, isLLMConfigured } from '@/lib/pulse/assistant';
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

  const result = await askPulse(websiteId, body.question);
  return json(result);
}
