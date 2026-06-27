import { z } from 'zod';
import { ApplicationStatus } from '../types';

export const applySchema = z.object({
  body: z.object({
    coverLetter: z.string().max(5000).optional(),
    resumePath: z.string().optional(),
  }),
  params: z.object({
    jobId: z.string().min(1),
  }),
});

export const updateApplicationStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(ApplicationStatus),
    note: z.string().max(1000).optional(),
  }),
  params: z.object({
    applicationId: z.string().min(1),
  }),
});
