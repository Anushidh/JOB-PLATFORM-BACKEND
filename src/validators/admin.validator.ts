import { z } from 'zod';

export const rejectJobSchema = z.object({
  body: z.object({
    reason: z.string().max(1000).optional(),
  }),
});

export const bulkJobActionSchema = z.object({
  body: z.object({
    jobIds: z.array(z.string()).min(1),
  }),
});
