import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { getExperimentResults } from '@/lib/pulse/experiments';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { badRequest, json, unauthorized } from '@/lib/response';
import { canUpdateWebsite, canViewWebsite } from '@/permissions';

const variantSchema = z.object({
  key: z.string().regex(/^[a-z0-9-_]+$/i).max(50),
  name: z.string().max(100).optional(),
  weight: z.coerce.number().positive().max(1000),
  control: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  key: z
    .string()
    .regex(/^[a-z0-9-_]+$/i, 'Key may only contain letters, numbers, dashes and underscores.')
    .max(50),
  conversionEvent: z.string().min(1).max(100),
  variants: z.array(variantSchema).min(2).max(5),
  status: z.enum(['draft', 'running', 'paused']).default('draft'),
});

function normaliseVariants(variants: z.infer<typeof variantSchema>[]) {
  const keys = new Set<string>();
  let controlSeen = false;
  return variants.map((v, i) => {
    if (keys.has(v.key)) throw new Error(`Duplicate variant key: ${v.key}`);
    keys.add(v.key);
    const control = i === 0 ? true : !!v.control && !controlSeen;
    if (control) controlSeen = true;
    return { key: v.key, name: v.name || v.key, weight: v.weight, control };
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  const experiments = await pulseDb().pulseExperiment.findMany({
    where: { websiteId },
    orderBy: { createdAt: 'desc' },
  });

  return json({ experiments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, createSchema);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  let variants;
  try {
    variants = normaliseVariants(body.variants);
  } catch (e: any) {
    return badRequest({ message: String(e?.message || e) });
  }

  const db = pulseDb();
  const existing = await db.pulseExperiment.findFirst({
    where: { websiteId, key: body.key },
  });
  if (existing) {
    return badRequest({ message: `An experiment with key "${body.key}" already exists.` });
  }

  const experiment = await db.pulseExperiment.create({
    data: {
      id: uuid(),
      websiteId,
      name: body.name,
      key: body.key,
      status: body.status,
      conversionEvent: body.conversionEvent,
      variants,
    },
  });

  return json({ experiment, results: await getExperimentResults(experiment) });
}
