import { z } from 'zod';

export const loginRequestSchema = z
  .object({
    username: z.string().meta({ description: 'Pulse username.' }),
    password: z.string().meta({ description: 'Pulse password.' }),
  })
  .meta({ id: 'LoginRequest' });
