import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getUserByUsername } from './user';

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      user: {
        findFirst: findFirstMock,
      },
    },
  },
}));

describe('getUserByUsername', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    findFirstMock.mockResolvedValue(null);
  });

  test('matches usernames case-insensitively', async () => {
    await getUserByUsername('KaKi87', { includePassword: true });

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        username: { equals: 'KaKi87', mode: 'insensitive' },
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        password: true,
        role: true,
        createdAt: true,
        twoFactorRequired: true,
      },
    });
  });

  test('can include deleted users while matching case-insensitively', async () => {
    await getUserByUsername('KaKi87', { showDeleted: true });

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        username: { equals: 'KaKi87', mode: 'insensitive' },
      },
      select: {
        id: true,
        username: true,
        password: false,
        role: true,
        createdAt: true,
        twoFactorRequired: true,
      },
    });
  });
});
