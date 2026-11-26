import { beforeEach, expect, test, vi } from 'vitest';
import { getBoard, getLink, getPixel, getUser, getWebsite } from '@/queries/prisma';
import { isEntityIdInUse } from './entity';

vi.mock('@/queries/prisma', () => ({
  getBoard: vi.fn(),
  getLink: vi.fn(),
  getPixel: vi.fn(),
  getUser: vi.fn(),
  getWebsite: vi.fn(),
}));

const id = '9b27b8ed-d01f-4a51-acaf-7b68f333431e';

beforeEach(() => {
  vi.mocked(getBoard).mockResolvedValue(null);
  vi.mocked(getLink).mockResolvedValue(null);
  vi.mocked(getPixel).mockResolvedValue(null);
  vi.mocked(getUser).mockResolvedValue(null);
  vi.mocked(getWebsite).mockResolvedValue(null);
});

test('isEntityIdInUse is false when no entity or user has the id', async () => {
  expect(await isEntityIdInUse(id)).toBe(false);
});

test('isEntityIdInUse is true when another entity already has the id', async () => {
  vi.mocked(getPixel).mockResolvedValue({ id } as any);

  expect(await isEntityIdInUse(id)).toBe(true);
});

// A user's dashboard board is created with the user's id on first use, so claiming
// that id early would let another entity shadow the dashboard once it exists.
test('isEntityIdInUse is true when the id belongs to a user, including deleted users', async () => {
  vi.mocked(getUser).mockResolvedValue({ id } as any);

  expect(await isEntityIdInUse(id)).toBe(true);
  expect(getUser).toHaveBeenCalledWith(id, { showDeleted: true });
});

// P-ADV-4: a non-UUID id must be rejected before any Prisma lookup, so the
// permission layer returns "no entity" instead of throwing P2007 (a 500).
test('getEntity returns null for a malformed id without querying the database', async () => {
  const { getEntity } = await import('./entity');

  expect(await getEntity('not-a-uuid')).toBeNull();
  expect(getWebsite).not.toHaveBeenCalled();
  expect(getLink).not.toHaveBeenCalled();
  expect(getPixel).not.toHaveBeenCalled();
  expect(getBoard).not.toHaveBeenCalled();
});

test('isEntityIdInUse is false for a malformed id without querying the database', async () => {
  expect(await isEntityIdInUse('not-a-uuid')).toBe(false);
  expect(getUser).not.toHaveBeenCalled();
});
