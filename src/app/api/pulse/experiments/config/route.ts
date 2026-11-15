import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { badRequest, json } from '@/lib/response';

// Public (unauthenticated) experiment config for the /pulse-ab.js add-on
// script. Returns only the experiments currently running for a website, in
// the shape the script needs to assign visitors to variants.
export async function GET(request: Request) {
  await parseRequest(request, undefined, { skipAuth: true });

  const url = new URL(request.url);
  const websiteId = url.searchParams.get('website');
  if (!websiteId) return badRequest({ message: 'website is required.' });

  const experiments = await pulseDb().pulseExperiment.findMany({
    where: { websiteId, status: 'running' },
    select: { id: true, key: true, name: true, conversionEvent: true, variants: true },
  });

  return json({
    experiments: (experiments as any[]).map(e => ({
      id: e.id,
      key: e.key,
      name: e.name,
      conversionEvent: e.conversionEvent,
      variants: (e.variants || []).map((v: any) => ({
        key: v.key,
        weight: v.weight,
        control: !!v.control,
      })),
    })),
  });
}
