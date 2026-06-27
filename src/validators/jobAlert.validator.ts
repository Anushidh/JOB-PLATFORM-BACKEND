import { z } from 'zod';

export const createAlertSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Alert name is required').max(100),
    filters: z.object({
      keywords: z.array(z.string()).optional(),
      location: z.string().optional(),
      jobType: z.array(z.string()).optional(),
      workMode: z.array(z.string()).optional(),
      experienceLevel: z.array(z.string()).optional(),
      salaryMin: z.number().positive().optional(),
      skills: z.array(z.string()).optional(),
    }),
    frequency: z.enum(['daily', 'weekly', 'instant']),
  }),
});

export const updateAlertSchema = z.object({
  params: z.object({
    alertId: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    filters: z.object({
      keywords: z.array(z.string()).optional(),
      location: z.string().optional(),
      jobType: z.array(z.string()).optional(),
      workMode: z.array(z.string()).optional(),
      experienceLevel: z.array(z.string()).optional(),
      salaryMin: z.number().positive().optional(),
      skills: z.array(z.string()).optional(),
    }).optional(),
    frequency: z.enum(['daily', 'weekly', 'instant']).optional(),
  }),
});
