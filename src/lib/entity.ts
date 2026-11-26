import type { Board, Link, Pixel, Website } from '@/generated/prisma/client';
import { getBoard, getLink, getPixel, getUser, getWebsite } from '@/queries/prisma';

// P-ADV-4: every entity id is a UUID column in the database. A malformed id
// must never reach Prisma, which throws an unhandled P2007 for non-UUID
// input and turns a bad path parameter into a 500. Permission checks treat
// a malformed id exactly like an unknown one (no entity, access denied),
// so routes answer with their normal 401/404 instead.
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidShape(id: unknown): id is string {
  return typeof id === 'string' && UUID_SHAPE.test(id);
}

export async function getEntity(entityId: string): Promise<Website | Link | Pixel | Board | null> {
  if (!isUuidShape(entityId)) {
    return null;
  }

  const [website, link, pixel, board] = await Promise.all([
    getWebsite(entityId),
    getLink(entityId),
    getPixel(entityId),
    getBoard(entityId),
  ]);

  const entity = website || link || pixel || board;

  return entity;
}

// Authorization resolves an id against every entity table, and dashboard boards use
// their owner's user id, so a caller-supplied id must not match any of them.
export async function isEntityIdInUse(id: string) {
  if (!isUuidShape(id)) {
    return false;
  }

  const [entity, user] = await Promise.all([getEntity(id), getUser(id, { showDeleted: true })]);

  return !!(entity || user);
}
