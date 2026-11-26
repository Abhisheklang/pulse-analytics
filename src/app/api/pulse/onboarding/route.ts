import { z } from 'zod';
import { getOnboardingState, updateOnboarding } from '@/lib/pulse/onboarding';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';

const updateSchema = z.object({
  dismissed: z.boolean().optional(),
  snippetConfirmed: z.boolean().optional(),
});

export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  if (!auth?.user?.id) return unauthorized();

  return json(await getOnboardingState(auth.user as any));
}

export async function PUT(request: Request) {
  const { auth, body, error } = await parseRequest(request, updateSchema);
  if (error) return error();
  if (!auth?.user?.id) return unauthorized();

  return json(await updateOnboarding(auth.user.id, body));
}
