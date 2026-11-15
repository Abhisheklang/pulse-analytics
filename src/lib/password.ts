import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const SYSTEM_USER_ID = '41e2b680-648e-4b09-bcd7-3e2b10c06264';
const SYSTEM_USER_PASSWORD_HASH = '$2b$10$50MfWf8HkyQfP/CF5PSMBu6DHOoe5mk6m2QPMwZJioF3/I4wlh2Fm';

export function hashPassword(password: string, rounds = SALT_ROUNDS) {
  return bcrypt.hashSync(password, rounds);
}

export function checkPassword(password: string, passwordHash: string) {
  return bcrypt.compareSync(password, passwordHash);
}

export function hasDefaultPassword(user: { id: string; password: string } | null | undefined) {
  // Cloud accounts are not created by the seed migration.
  if (process.env.CLOUD_MODE) {
    return false;
  }

  return user?.id === SYSTEM_USER_ID && user.password === SYSTEM_USER_PASSWORD_HASH;
}
